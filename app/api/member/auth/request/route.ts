import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { generateLoginToken, hashLoginToken } from "@/lib/memberTokens";
import { memberLoginRateLimitKeys } from "@/lib/memberLoginRateLimit";
import { logIdentityLookup } from "@/lib/auditLog";
import { resolveOtisAppUrl } from "@/lib/otisAppUrl";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] ?? character));
}

// POST /api/member/auth/request  { email }
// Sends a passwordless magic-link to a member's email. Always responds with the
// same generic message whether or not the email matches a member, so membership
// can't be enumerated. The link points at /api/member/auth/verify?token=…
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawEmail: unknown = body?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  const noStoreHeaders = { "Cache-Control": "no-store, private" };
  // Same success response for every membership result. Real failures are
  // logged server-side; callers never learn whether an email has a member.
  const genericOk = NextResponse.json({
    ok: true,
    message: "If that email is on a team, we've sent a sign-in link.",
  }, { headers: noStoreHeaders });

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400, headers: noStoreHeaders }
    );
  }

  // This must run before the membership lookup so unknown emails cannot evade
  // the durable limiter or become an oracle. The database receives HMACed
  // keys only, never the raw email or client IP.
  let rateLimitKeys;
  try {
    rateLimitKeys = memberLoginRateLimitKeys(req, email);
  } catch (error) {
    // A missing/invalid server secret is an operational failure. Fail closed
    // by not minting or emailing a token, while preserving the generic reply.
    console.error("[member/auth/request] rate-limit key creation failed:", error);
    return genericOk;
  }

  const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc(
    "consume_member_login_request_rate_limit",
    {
      p_combination_key_hash: rateLimitKeys.combinationKeyHash,
      p_email_key_hash: rateLimitKeys.emailKeyHash,
    }
  );
  const rateLimit = rateLimitData?.[0];
  if (rateLimitError || !rateLimit || typeof rateLimit.allowed !== "boolean") {
    // The limiter is an abuse boundary, so a database fault must not fall
    // through to token creation. A generic 200 keeps this failure
    // non-enumerating just like an unknown email address.
    console.error(
      "[member/auth/request] durable rate limit failed:",
      rateLimitError?.message ?? "empty or malformed RPC response"
    );
    return genericOk;
  }
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(1, rateLimit.retry_after_seconds ?? 60);
    return NextResponse.json(
      {
        ok: false,
        message: "Too many sign-in requests. Please wait a few minutes and try again.",
      },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  // 1) Is this email on any member? Query member_identity (identity table).
  //    Works the same for 1 or many matches — token is keyed to the email.
  const { data: identities, error: lookupError } = await supabaseAdmin
    .from("member_identity")
    .select("member_id, display_name")
    .ilike("email", email);

  if (lookupError) {
    console.error("[member/auth/request] identity lookup failed:", lookupError);
    return genericOk;
  }
  // Count only (no PII) — confirms the multi-match path was reached.
  console.info(`[member/auth/request] email matched ${identities?.length ?? 0} member(s)`);
  if (!identities || identities.length === 0) {
    return genericOk; // unknown email — say nothing
  }
  const members = identities;
  void logIdentityLookup(members[0].member_id, "auth_request", "magic-link email lookup");

  let appUrl: string;
  try {
    appUrl = resolveOtisAppUrl(req.nextUrl.origin);
  } catch (error) {
    // Preserve the non-enumerating browser response, but do not mint a token
    // or send a link until operators configure a safe canonical app URL.
    console.error("[member/auth/request] canonical magic-link URL unavailable:", error);
    return genericOk;
  }

  // 2) Mint + store a single-use token (only its hash). Done BEFORE the email
  //    step so a missing/misconfigured email provider can never prevent token
  //    creation — the token is the actual auth artefact.
  const rawToken = generateLoginToken();
  const tokenHash = hashLoginToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  const { error: insertError } = await supabaseAdmin.from("member_login_tokens").insert({
    email,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    // Log the full Postgres error so RLS/permission failures are obvious (this
    // is what was silently swallowed before — e.g. code 42501 = RLS violation).
    console.error(
      `[member/auth/request] token insert failed (code ${insertError.code}): ${insertError.message}`,
      insertError.details ?? "",
      insertError.hint ?? ""
    );
    return genericOk;
  }
  console.info("[member/auth/request] login token created");

  // In local development, print a usable link even when Resend is not
  // configured. Localhost testing should not depend on real email delivery.
  const loginUrl = `${appUrl}/api/member/auth/verify?token=${rawToken}`;
  if (process.env.NODE_ENV === "development") {
    console.log(`\n[DEV] Magic link for ${email}:\n${loginUrl}\n`);
    return NextResponse.json({
      ok: true,
      message: "Local sign-in link created.",
      // This is deliberately returned only by localhost development mode.
      // Production retains the non-enumerating email-only response.
      dev_login_url: loginUrl,
    }, { headers: noStoreHeaders });
  }

  // 3) Email the magic link. This is the ONLY step that needs Resend; if the
  //    key is missing the token still exists (visible for diagnostics), we just
  //    couldn't deliver the link.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[member/auth/request] RESEND_API_KEY not set — token created but no email sent"
    );
    return genericOk;
  }

  const firstName = (members[0].display_name || "there").split(" ")[0];
  const safeFirstName = escapeHtml(firstName);
  const safeLoginUrl = escapeHtml(loginUrl);

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Otis <otis@wavelength.team>",
    to: email,
    subject: "Your Wavelength sign-in link",
    html: `
<p>Hi ${safeFirstName},</p>

<p>Here's your secure link to sign in to your Wavelength profile, where you can see your responses and your team's workshop materials.</p>

<p><a href="${safeLoginUrl}" style="display:inline-block;background:#1A1A2E;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;">Sign in to Wavelength</a></p>

<p>Or paste this link into your browser:<br/><a href="${safeLoginUrl}">${safeLoginUrl}</a></p>

<p style="color:#888;font-size:13px;">This link is personal to you and expires in 30 minutes. If you didn't request it, you can safely ignore this email. Need help? <a href="mailto:contact@wavelength.team?subject=Otis%20member%20sign-in%20support">Contact Wavelength support</a>.</p>
    `.trim(),
  });

  if (sendError) {
    console.error("[member/auth/request] Resend error:", sendError);
  }

  return genericOk;
}
