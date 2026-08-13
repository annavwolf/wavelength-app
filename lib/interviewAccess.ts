// Server-only controls for the public Phase 1 interview. An emailed invite is
// a bearer capability, not an identifier: the member UUID by itself is never
// accepted as authorization.

import "server-only";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  INTERVIEW_SESSION_COOKIE,
  INTERVIEW_SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE,
  sessionCookieOptions,
  signInterviewSession,
  verifyInterviewSession,
  verifySession,
} from "@/lib/memberSession";
import { supabaseAdmin } from "@/lib/supabase";

const INTERVIEW_TOKEN_TTL_DAYS = 90;
const MIN_TOKEN_LENGTH = 32;

export const INTERVIEW_ACCESS_ERROR =
  "This assessment link is invalid or has expired. Please ask your consultant for a new link.";

export type InterviewAccess = {
  memberId: string;
  teamId: string;
  source: "invite" | "member";
  tokenId?: string;
};

export type PublicRosterMember = {
  // This is the team-scoped participant code, not a member UUID and never an
  // authorization credential. It is used only to submit a coordination rating.
  roster_key: string;
  display_name: string;
  is_self: boolean;
};

type AccessResult =
  | { ok: true; value: InterviewAccess }
  | { ok: false; response: NextResponse };

type TokenLookup = {
  id: string;
  member_id: string;
  expires_at: string;
  revoked_at: string | null;
};

function accessDenied(status = 401): NextResponse {
  return NextResponse.json(
    { error: INTERVIEW_ACCESS_ERROR },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function accessFailure(message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function generateInterviewAccessToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInterviewAccessToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function isPlausibleRawToken(rawToken: string | null | undefined): rawToken is string {
  return typeof rawToken === "string" && rawToken.length >= MIN_TOKEN_LENGTH && rawToken.length <= 256;
}

/**
 * Create an additional active participant invite. This intentionally does not
 * revoke older links, so re-sending an invitation never locks a person out on
 * another device. Call revokeInterviewAccessTokens when access must end.
 */
export async function issueInterviewAccessToken({
  memberId,
  teamId,
}: {
  memberId: string;
  teamId?: string;
}): Promise<{ token: string; tokenId: string; expiresAt: string }> {
  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("member_id, team_id, status")
    .eq("member_id", memberId)
    .maybeSingle();
  if (memberError) throw new Error("Unable to verify participant for secure invite.");
  if (!member || (teamId && member.team_id !== teamId) || member.status === "opted_out") {
    throw new Error("Participant is not available for a secure invite.");
  }

  const token = generateInterviewAccessToken();
  const expiresAt = new Date(Date.now() + INTERVIEW_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: created, error } = await supabaseAdmin
    .from("member_interview_tokens")
    .insert({
      member_id: member.member_id,
      token_hash: hashInterviewAccessToken(token),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("Unable to create secure interview link.");

  return { token, tokenId: created.id, expiresAt };
}

export function interviewAccessUrl(appUrl: string, rawToken: string): string {
  return `${appUrl.replace(/\/$/, "")}/i/${encodeURIComponent(rawToken)}`;
}

async function activeTokenForRawValue(rawToken: string): Promise<
  | { ok: true; token: TokenLookup }
  | { ok: false; unavailable: boolean }
> {
  const { data, error } = await supabaseAdmin
    .from("member_interview_tokens")
    .select("id, member_id, expires_at, revoked_at")
    .eq("token_hash", hashInterviewAccessToken(rawToken))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return { ok: false, unavailable: true };
  if (!data) return { ok: false, unavailable: false };
  return { ok: true, token: data };
}

async function activeTokenById(tokenId: string, memberId: string): Promise<
  | { ok: true }
  | { ok: false; unavailable: boolean }
> {
  const { data, error } = await supabaseAdmin
    .from("member_interview_tokens")
    .select("id")
    .eq("id", tokenId)
    .eq("member_id", memberId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return { ok: false, unavailable: true };
  return data ? { ok: true } : { ok: false, unavailable: false };
}

async function memberForInviteToken(token: TokenLookup): Promise<
  | { ok: true; value: InterviewAccess }
  | { ok: false; unavailable: boolean }
> {
  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("member_id, team_id, status")
    .eq("member_id", token.member_id)
    .maybeSingle();
  if (error) return { ok: false, unavailable: true };
  if (!member || member.status === "opted_out") return { ok: false, unavailable: false };
  return {
    ok: true,
    value: {
      memberId: member.member_id,
      teamId: member.team_id,
      source: "invite",
      tokenId: token.id,
    },
  };
}

/**
 * Redeem a raw invite only at the opaque /i/[token] entry route or session
 * bootstrap. The raw value is never persisted or included in a cookie.
 */
export async function redeemInterviewAccessToken(rawToken: string | null | undefined): Promise<AccessResult> {
  if (!isPlausibleRawToken(rawToken)) return { ok: false, response: accessDenied() };
  const tokenResult = await activeTokenForRawValue(rawToken);
  if (!tokenResult.ok) {
    return {
      ok: false,
      response: tokenResult.unavailable ? accessFailure("Unable to verify this assessment link.") : accessDenied(),
    };
  }
  const memberResult = await memberForInviteToken(tokenResult.token);
  if (!memberResult.ok) {
    return {
      ok: false,
      response: memberResult.unavailable ? accessFailure("Unable to verify this assessment link.") : accessDenied(),
    };
  }

  // This is deliberately best-effort audit metadata. It must not change the
  // access decision or surface a raw token should the update fail.
  void supabaseAdmin
    .from("member_interview_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenResult.token.id);

  return { ok: true, value: memberResult.value };
}

function matchesExpected(
  access: InterviewAccess,
  expected?: { memberId?: string; teamId?: string }
): NextResponse | null {
  if (
    (expected?.memberId && expected.memberId !== access.memberId) ||
    (expected?.teamId && expected.teamId !== access.teamId)
  ) {
    // Do not disclose whether the nominated UUID belongs to a real participant.
    return accessDenied(403);
  }
  return null;
}

/**
 * Authorize a Phase 1 request using either the long-lived member-login cookie
 * (which is naturally scoped to its own member) or the short interview cookie
 * created after a secure invite is redeemed. A bare member UUID never works.
 */
export async function requireInterviewAccess(
  request: NextRequest,
  expected?: { memberId?: string; teamId?: string }
): Promise<AccessResult> {
  const memberSession = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (memberSession) {
    const value: InterviewAccess = {
      memberId: memberSession.member_id,
      teamId: memberSession.team_id,
      source: "member",
    };
    const mismatch = matchesExpected(value, expected);
    if (!mismatch) return { ok: true, value };
    // A shared device can legitimately hold one member's profile cookie while
    // another participant opens their own personal invite. Give the narrower
    // interview cookie a chance to match before rejecting the request.
  }

  const interviewSession = await verifyInterviewSession(
    request.cookies.get(INTERVIEW_SESSION_COOKIE)?.value
  );
  if (!interviewSession) {
    return { ok: false, response: memberSession ? accessDenied(403) : accessDenied() };
  }

  const value: InterviewAccess = {
    memberId: interviewSession.member_id,
    teamId: interviewSession.team_id,
    source: "invite",
    ...(interviewSession.token_id ? { tokenId: interviewSession.token_id } : {}),
  };
  const mismatch = matchesExpected(value, expected);
  if (mismatch) return { ok: false, response: mismatch };

  // An invite-derived cookie remains valid only while its originating token is
  // active. This makes server-side revocation take effect immediately.
  if (value.tokenId) {
    const token = await activeTokenById(value.tokenId, value.memberId);
    if (!token.ok) {
      return {
        ok: false,
        response: token.unavailable ? accessFailure("Unable to verify this assessment link.") : accessDenied(),
      };
    }
  }
  return { ok: true, value };
}

export async function setInterviewAccessCookie(
  response: NextResponse,
  access: InterviewAccess
): Promise<NextResponse> {
  const jwt = await signInterviewSession({
    member_id: access.memberId,
    team_id: access.teamId,
    ...(access.tokenId ? { token_id: access.tokenId } : {}),
  });
  response.cookies.set(
    INTERVIEW_SESSION_COOKIE,
    jwt,
    sessionCookieOptions(INTERVIEW_SESSION_COOKIE_MAX_AGE)
  );
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

/**
 * Revoke every secure invite for a participant (for withdrawal/deletion or a
 * consultant-requested link reset). When a team is supplied, verify ownership
 * of the membership before changing anything: a team owner must never be able
 * to revoke a participant link that belongs to another team.
 */
export async function revokeInterviewAccessTokens(
  memberId: string,
  teamId?: string
): Promise<{ error: Error | null }> {
  if (teamId) {
    const { data: member, error: memberError } = await supabaseAdmin
      .from("members")
      .select("member_id")
      .eq("member_id", memberId)
      .eq("team_id", teamId)
      .maybeSingle();
    if (memberError || !member) {
      return { error: new Error("Participant is not available for this team.") };
    }
  }

  const { error } = await supabaseAdmin
    .from("member_interview_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .is("revoked_at", null);
  return { error: error ? new Error(error.message) : null };
}
