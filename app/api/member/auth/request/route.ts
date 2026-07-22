import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { generateLoginToken, hashLoginToken } from "@/lib/memberTokens";

// POST /api/member/auth/request  { email }
// Sends a passwordless magic-link to a member's email. Always responds with the
// same generic message whether or not the email matches a member, so membership
// can't be enumerated. The link points at /api/member/auth/verify?token=…
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawEmail: unknown = body?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  // Same response in every branch (no enumeration). Real failures are logged.
  const genericOk = NextResponse.json({
    ok: true,
    message: "If that email is on a team, we've sent a sign-in link.",
  });

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  // 1) Is this email on any member? (case-insensitive). Works the same for 1 or
  //    many matches — the token is keyed to the email, and the multi-team case
  //    is resolved later, in /verify, by the team chooser.
  const { data: members, error: lookupError } = await supabase
    .from("members")
    .select("member_id, display_name")
    .ilike("email", email);

  if (lookupError) {
    console.error("[member/auth/request] member lookup failed:", lookupError);
    return genericOk;
  }
  // Count only (no PII) — helps confirm the multi-match path was reached.
  console.info(`[member/auth/request] email matched ${members?.length ?? 0} member(s)`);
  if (!members || members.length === 0) {
    return genericOk; // unknown email — say nothing
  }

  // 2) Mint + store a single-use token (only its hash). Done BEFORE the email
  //    step so a missing/misconfigured email provider can never prevent token
  //    creation — the token is the actual auth artefact.
  const rawToken = generateLoginToken();
  const tokenHash = hashLoginToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  const { error: insertError } = await supabase.from("member_login_tokens").insert({
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

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const loginUrl = `${APP_URL}/api/member/auth/verify?token=${rawToken}`;
  const firstName = (members[0].display_name || "there").split(" ")[0];

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from: "Wavelength <onboarding@resend.dev>",
    to: email,
    subject: "Your Wavelength sign-in link",
    html: `
<p>Hi ${firstName},</p>

<p>Here's your secure link to sign in to your Wavelength profile, where you can see your responses and your team's workshop materials.</p>

<p><a href="${loginUrl}" style="display:inline-block;background:#1A1A2E;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;">Sign in to Wavelength</a></p>

<p>Or paste this link into your browser:<br/><a href="${loginUrl}">${loginUrl}</a></p>

<p style="color:#888;font-size:13px;">This link is personal to you and expires in 30 minutes. If you didn't request it, you can safely ignore this email.</p>
    `.trim(),
  });

  if (sendError) {
    console.error("[member/auth/request] Resend error:", sendError);
  }

  return genericOk;
}
