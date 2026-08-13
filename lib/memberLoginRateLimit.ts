// Durable rate-limit key derivation for member magic-link requests.
//
// This module is intentionally server-only: it turns an email and the
// request's client address into HMAC-SHA-256 keys before either reaches the
// database. The rate-limit table never receives raw email or IP values.

import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

const RATE_LIMIT_SECRET_MIN_LENGTH = 16;

function rateLimitSecret(): string {
  // A dedicated secret makes it possible to rotate rate-limit keys without
  // rotating member sessions. The session secret is a safe transition fallback
  // because it is already server-only and mandatory for member auth.
  const secret =
    process.env.MEMBER_LOGIN_RATE_LIMIT_SECRET ??
    process.env.MEMBER_SESSION_SECRET;

  if (!secret || secret.length < RATE_LIMIT_SECRET_MIN_LENGTH) {
    throw new Error(
      "MEMBER_LOGIN_RATE_LIMIT_SECRET (or MEMBER_SESSION_SECRET) must be configured."
    );
  }

  return secret;
}

function clientAddress(request: NextRequest): string {
  // Vercel's header is preferred because it is supplied by the platform. The
  // email-wide key below still limits abuse if a local proxy lets callers vary
  // a forwarded-address header.
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  return forwarded.split(",")[0]?.trim().slice(0, 256) || "unknown";
}

function keyedHash(scope: string, ...values: string[]): string {
  const hmac = createHmac("sha256", rateLimitSecret());
  hmac.update("otis:member-login-rate-limit:v1:\u0000");
  hmac.update(scope);
  for (const value of values) {
    hmac.update("\u0000");
    hmac.update(value);
  }
  return hmac.digest("hex");
}

export type MemberLoginRateLimitKeys = {
  // 3 requests / 15 minutes for a single email + client-address pair.
  combinationKeyHash: string;
  // 10 requests / hour for an email regardless of client address.
  emailKeyHash: string;
};

/**
 * Produce opaque, keyed hashes for the durable Postgres limiter. Email input
 * is normalized the same way the case-insensitive membership lookup behaves.
 */
export function memberLoginRateLimitKeys(
  request: NextRequest,
  normalizedEmail: string
): MemberLoginRateLimitKeys {
  const email = normalizedEmail.trim().toLowerCase();
  return {
    combinationKeyHash: keyedHash("combination", email, clientAddress(request)),
    emailKeyHash: keyedHash("email", email),
  };
}
