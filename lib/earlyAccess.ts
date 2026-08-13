import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const EARLY_ACCESS_SUPPORT_EMAIL = "contact@wavelength.team";
export const PENDING_EARLY_ACCESS_COOKIE = "otis_early_access_pending";

// Long enough for someone to open an email-confirmation tab, but short enough
// that a forgotten browser cannot hold a reusable beta claim for days.
const PENDING_EARLY_ACCESS_MAX_AGE = 60 * 30;
const PENDING_EARLY_ACCESS_ISSUER = "wavelength-otis";
const PENDING_EARLY_ACCESS_AUDIENCE = "early-access-pending";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 2_000;

type RateLimitScope = "pending" | "redeem";
type RateLimitEntry = { startedAt: number; attempts: number };

// This is deliberately bounded: it is a useful first line of defence in local
// development and a single serverless instance, not a substitute for an edge
// rate-limit/WAF policy shared across Vercel instances.
const earlyAccessRateLimits = new Map<string, RateLimitEntry>();

export type EarlyAccessEntitlement = {
  granted: boolean;
  grantedAt: string | null;
};

type RedeemEarlyAccessResult =
  | { ok: true; entitlement: EarlyAccessEntitlement; alreadyGranted: boolean }
  | { ok: false; reason: "not_configured" | "invalid_code" | "database_error" };

function configuredCodeHashes(): Buffer[] {
  const value = process.env.EARLY_ACCESS_CODE_HASHES ?? "";
  return value
    .split(",")
    .map((hash) => hash.trim().toLowerCase())
    .filter((hash) => /^[a-f0-9]{64}$/.test(hash))
    .map((hash) => Buffer.from(hash, "hex"));
}

function codeHash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function matchesConfiguredHash(candidateHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(candidateHash)) return false;

  const hashes = configuredCodeHashes();
  if (hashes.length === 0) return false;

  const candidate = Buffer.from(candidateHash, "hex");
  // Compare every configured hash even after a match, so callers cannot use
  // timing to learn which configured code was presented.
  let matched = false;
  for (const expected of hashes) {
    matched = timingSafeEqual(candidate, expected) || matched;
  }
  return matched;
}

export function earlyAccessCodesAreConfigured(): boolean {
  return configuredCodeHashes().length > 0;
}

function matchesConfiguredCode(code: string): boolean {
  return matchesConfiguredHash(codeHash(code));
}

function pendingClaimSecret(): Uint8Array {
  // A dedicated secret is preferred. The member-session secret is an
  // intentional backwards-compatible fallback so deploying this improvement
  // does not strand a signup before an operator has added the new variable.
  const secret =
    process.env.EARLY_ACCESS_PENDING_COOKIE_SECRET ??
    process.env.MEMBER_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "EARLY_ACCESS_PENDING_COOKIE_SECRET (or MEMBER_SESSION_SECRET) is not configured."
    );
  }
  // Derive a separate HMAC key rather than reusing the member-cookie signing
  // key directly across two different credential types.
  return createHash("sha256")
    .update("otis:early-access-pending:v1:\u0000")
    .update(secret)
    .digest();
}

function pendingCookieOptions(maxAge = PENDING_EARLY_ACCESS_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    // The claim never needs to accompany normal application traffic. Lax
    // permits the top-level confirmation-link navigation to this callback.
    path: "/auth/callback",
    maxAge,
  };
}

/** Remove a pending sign-up claim from both the browser and outgoing response. */
export function clearPendingEarlyAccessClaim(response: NextResponse) {
  response.cookies.set(PENDING_EARLY_ACCESS_COOKIE, "", {
    ...pendingCookieOptions(0),
    expires: new Date(0),
  });
}

/**
 * Validate a raw code while it is only in server memory, then put its SHA-256
 * hash (never the raw code) in an HttpOnly, signed, short-lived cookie.
 */
export async function issuePendingEarlyAccessClaim(
  response: NextResponse,
  submittedCode: string
): Promise<void> {
  const normalized = submittedCode.trim();
  if (!normalized || !matchesConfiguredCode(normalized)) {
    // Clear any older valid claim when a new code is invalid, so a stale claim
    // cannot accidentally apply to a later account created in this browser.
    clearPendingEarlyAccessClaim(response);
    return;
  }

  const hash = codeHash(normalized);
  const token = await new SignJWT({
    early_access_pending: true,
    code_hash: hash,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(PENDING_EARLY_ACCESS_ISSUER)
    .setAudience(PENDING_EARLY_ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${PENDING_EARLY_ACCESS_MAX_AGE}s`)
    .sign(pendingClaimSecret());

  response.cookies.set(
    PENDING_EARLY_ACCESS_COOKIE,
    token,
    pendingCookieOptions()
  );
}

/**
 * Read and validate a pending claim. The caller must clear the cookie whether
 * verification succeeds or fails; a claim is single-use from the app's point
 * of view even though it is not persisted in the database.
 */
export async function readPendingEarlyAccessClaim(
  token: string | undefined
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, pendingClaimSecret(), {
      algorithms: ["HS256"],
      issuer: PENDING_EARLY_ACCESS_ISSUER,
      audience: PENDING_EARLY_ACCESS_AUDIENCE,
    });
    if (
      payload.early_access_pending === true &&
      typeof payload.code_hash === "string" &&
      matchesConfiguredHash(payload.code_hash)
    ) {
      return payload.code_hash.toLowerCase();
    }
  } catch {
    // A malformed, expired, or old-key cookie is simply not a claim.
  }
  return null;
}

function clientAddress(request: NextRequest): string {
  // Vercel provides a trusted forwarded address. Fall back safely for local
  // development; the value is only used as a one-way hashed rate-limit key.
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

function boundedPruneRateLimits(now: number) {
  if (earlyAccessRateLimits.size <= MAX_RATE_LIMIT_KEYS) return;
  for (const [key, value] of Array.from(earlyAccessRateLimits.entries())) {
    if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) {
      earlyAccessRateLimits.delete(key);
    }
  }
  while (earlyAccessRateLimits.size > MAX_RATE_LIMIT_KEYS) {
    const oldest = earlyAccessRateLimits.keys().next().value as string | undefined;
    if (!oldest) break;
    earlyAccessRateLimits.delete(oldest);
  }
}

/**
 * A bounded per-instance rate limiter. Production should additionally enforce
 * a Vercel WAF/edge rule because serverless instances do not share memory.
 */
export function consumeEarlyAccessRateLimit(
  request: NextRequest,
  scope: RateLimitScope,
  accountId?: string
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  boundedPruneRateLimits(now);
  const limit = scope === "pending" ? 8 : 10;
  const rateSecret =
    process.env.EARLY_ACCESS_RATE_LIMIT_SECRET ??
    process.env.EARLY_ACCESS_PENDING_COOKIE_SECRET ??
    process.env.MEMBER_SESSION_SECRET ??
    "local-fallback";
  const key = createHash("sha256")
    .update("otis:early-access-rate-limit:v1:\u0000")
    .update(rateSecret)
    .update("\u0000")
    .update(scope)
    .update("\u0000")
    .update(clientAddress(request))
    .update("\u0000")
    .update(accountId ?? "")
    .digest("base64url");
  const existing = earlyAccessRateLimits.get(key);

  if (!existing || now - existing.startedAt >= RATE_LIMIT_WINDOW_MS) {
    earlyAccessRateLimits.set(key, { startedAt: now, attempts: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.attempts += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((RATE_LIMIT_WINDOW_MS - (now - existing.startedAt)) / 1000)
  );
  return { allowed: existing.attempts <= limit, retryAfterSeconds };
}

export async function getEarlyAccessEntitlement(
  consultantId: string
): Promise<{ entitlement: EarlyAccessEntitlement; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("consultants")
    .select("early_access_granted_at")
    .eq("consultant_id", consultantId)
    .maybeSingle();

  if (error) {
    return {
      entitlement: { granted: false, grantedAt: null },
      error: error.message,
    };
  }

  const grantedAt = data?.early_access_granted_at ?? null;
  return { entitlement: { granted: Boolean(grantedAt), grantedAt }, error: null };
}

export async function redeemEarlyAccessCode(
  consultantId: string,
  submittedCode: string
): Promise<RedeemEarlyAccessResult> {
  return redeemEarlyAccessCodeHash(consultantId, codeHash(submittedCode.trim()));
}

/**
 * Grant an authenticated consultant from a prevalidated hash. This is used by
 * the confirmation callback; it never needs (or accepts) a raw access code.
 */
export async function redeemEarlyAccessCodeHash(
  consultantId: string,
  submittedCodeHash: string
): Promise<RedeemEarlyAccessResult> {
  const current = await getEarlyAccessEntitlement(consultantId);
  if (current.error) return { ok: false, reason: "database_error" };
  if (current.entitlement.granted) {
    return { ok: true, entitlement: current.entitlement, alreadyGranted: true };
  }

  if (!earlyAccessCodesAreConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  if (!matchesConfiguredHash(submittedCodeHash)) {
    return { ok: false, reason: "invalid_code" };
  }

  const grantedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("consultants")
    .upsert(
      {
        consultant_id: consultantId,
        early_access_granted_at: grantedAt,
        early_access_grant_source: "code",
      },
      { onConflict: "consultant_id" }
    );

  if (error) return { ok: false, reason: "database_error" };
  return {
    ok: true,
    entitlement: { granted: true, grantedAt },
    alreadyGranted: false,
  };
}
