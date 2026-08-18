import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logIdentityLookups } from "@/lib/auditLog";
import { hashLoginToken } from "@/lib/memberTokens";
import {
  signSession,
  signPreSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  PRESESSION_COOKIE,
  INTERVIEW_SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  PRESESSION_COOKIE_MAX_AGE,
  type PreSessionCandidate,
} from "@/lib/memberSession";

// GET /api/member/auth/verify?token=…
// Validates a single-use magic-link token, then either signs the member in
// (one matching member) or hands off to the "which team?" chooser (several).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/member-login?error=${encodeURIComponent(reason)}`, req.nextUrl.origin));

  if (!token) return fail("missing");

  const tokenHash = hashLoginToken(token);

  const { data: row, error } = await supabaseAdmin
    .from("member_login_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("[member/auth/verify] token lookup failed:", error);
    return fail("server");
  }
  if (!row) return fail("invalid");
  if (row.used_at) return fail("used");
  if (new Date(row.expires_at).getTime() < Date.now()) return fail("expired");

  // Single-use: burn the token immediately.
  const { error: burnError } = await supabaseAdmin
    .from("member_login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null);
  if (burnError) {
    console.error("[member/auth/verify] failed to mark token used:", burnError);
    return fail("server");
  }

  // Resolve the member(s) for this email. Use the same canonical matching as the
  // request route so a token minted for a case / whitespace / Gmail-alias variant
  // of the roster address still resolves to its member(s) at verify time.
  const { data: identities, error: identityError } = await supabaseAdmin.rpc(
    "find_member_identities_by_email",
    { p_email: row.email }
  );

  if (identityError) {
    console.error("[member/auth/verify] identity lookup failed:", identityError);
    return fail("server");
  }
  if (!identities || identities.length === 0) return fail("nomember");

  // Fetch remaining fields (private_code, role) from members.
  const memberIds = identities.map((i) => i.member_id);
  const { data: memberRows, error: memberError } = await supabaseAdmin
    .from("members")
    .select("member_id, team_id, private_code, role")
    .in("member_id", memberIds);

  if (memberError) {
    console.error("[member/auth/verify] member fetch failed:", memberError);
    return fail("server");
  }
  const memberRowById = new Map((memberRows ?? []).map((m) => [m.member_id, m]));
  const members = identities.map((i) => ({
    ...memberRowById.get(i.member_id),
    member_id: i.member_id,
    team_id: i.team_id,
    display_name: i.display_name,
  }));

  void logIdentityLookups(memberIds, "auth_verify", "magic-link sign-in");

  // Exactly one member → sign in.
  if (members.length === 1) {
    const m = members[0];
    const jwt = await signSession({ member_id: m.member_id, team_id: m.team_id });
    const res = NextResponse.redirect(new URL("/me", req.nextUrl.origin));
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions(SESSION_COOKIE_MAX_AGE));
    // Do not carry a previous recipient's invite capability into a fresh
    // passwordless sign-in on a shared browser.
    res.cookies.set(INTERVIEW_SESSION_COOKIE, "", sessionCookieOptions(0));
    return res;
  }

  // Several members share this email (multi-team) → chooser. Attach team names.
  const teamIds = Array.from(new Set(members.map((m) => m.team_id)));
  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("team_id, team_name")
    .in("team_id", teamIds);
  const teamName = new Map((teams ?? []).map((t) => [t.team_id, t.team_name]));

  if (members.some((member) => !member.private_code)) {
    console.error("[member/auth/verify] member is missing a private code");
    return fail("server");
  }

  const candidates: PreSessionCandidate[] = members.map((m) => ({
    member_id: m.member_id,
    team_id: m.team_id,
    team_name: teamName.get(m.team_id) ?? "Your team",
    display_name: m.display_name,
    private_code: m.private_code as string,
    role: m.role ?? null,
  }));

  const preJwt = await signPreSession({ email: row.email, candidates });
  const res = NextResponse.redirect(new URL("/member-login/select-team", req.nextUrl.origin));
  res.cookies.set(PRESESSION_COOKIE, preJwt, sessionCookieOptions(PRESESSION_COOKIE_MAX_AGE));
  return res;
}
