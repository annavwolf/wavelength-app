// Signed member session helpers. Edge-safe (jose only — no node:crypto), so
// this module can be imported by both middleware.ts (edge runtime) and the
// member API routes (node runtime).
//
// Member auth is deliberately SEPARATE from the consultant's Supabase Auth:
// a member session is this signed cookie, and it grants access to /me only.
// It is never a Supabase session, so it can never unlock the consultant
// dashboard (see components/AuthGate.tsx + middleware.ts).

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "otis_member_session";
export const PRESESSION_COOKIE = "otis_member_presession";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const PRESESSION_MAX_AGE = 60 * 30; // 30 min — just long enough to pick a team

export type MemberSession = {
  member_id: string;
  team_id: string;
};

// A candidate shown in the "which team?" chooser when one email is on members
// in several teams. Carried in the short-lived pre-session so the chooser needs
// no DB lookup and can't be tampered with.
export type PreSessionCandidate = {
  member_id: string;
  team_id: string;
  team_name: string;
  display_name: string;
};

export type PreSession = {
  email: string;
  candidates: PreSessionCandidate[];
};

function getSecret(): Uint8Array {
  const secret = process.env.MEMBER_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "MEMBER_SESSION_SECRET is not set (or too short). Add it to .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: MemberSession): Promise<string> {
  return new SignJWT({ member_id: payload.member_id, team_id: payload.team_id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.member_id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string | undefined | null
): Promise<MemberSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.member_id === "string" && typeof payload.team_id === "string") {
      return { member_id: payload.member_id, team_id: payload.team_id };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signPreSession(payload: PreSession): Promise<string> {
  return new SignJWT({ email: payload.email, candidates: payload.candidates })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PRESESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifyPreSession(
  token: string | undefined | null
): Promise<PreSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.email === "string" &&
      Array.isArray(payload.candidates)
    ) {
      return {
        email: payload.email,
        candidates: payload.candidates as PreSessionCandidate[],
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Shared cookie attributes. HttpOnly so JS can't read the session; Secure in
// production; Lax so the emailed magic link (a top-level GET navigation) still
// arrives with the cookie set on the verify redirect.
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE;
export const PRESESSION_COOKIE_MAX_AGE = PRESESSION_MAX_AGE;
