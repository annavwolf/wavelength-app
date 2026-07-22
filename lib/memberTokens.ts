// Node-only login-token helpers. Imported ONLY by the member auth API routes
// (node runtime) — never by middleware — because node:crypto isn't edge-safe.
//
// Security: the raw token comes from crypto.randomBytes (a cryptographically
// secure RNG — never Math.random()). Only its SHA-256 hash is stored in the DB;
// the raw token lives only in the emailed magic-link URL.

import crypto from "crypto";

// 32 random bytes → 256 bits of entropy, url-safe so it drops straight into a link.
export function generateLoginToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashLoginToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
