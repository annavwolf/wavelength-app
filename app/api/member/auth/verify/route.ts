import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { hashLoginToken } from "@/lib/memberTokens";
import {
  signSession,
  signPreSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  PRESESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  PRESESSION_COOKIE_MAX_AGE,
  type PreSessionCandidate,
} from "@/lib/memberSession";

// GET /api/member/auth/verify?token=…
// Validates a single-use magic-link token, then either signs the member in
// (one matching member) or hands off to the "which team?" chooser (several).
export async function GET(req: NextRequest) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = req.nextUrl.searchParams.get("token");

  const fail = (reason: string) =>
    NextResponse.redirect(`${APP_URL}/member-login?error=${reason}`);

  if (!token) return fail("missing");

  const tokenHash = hashLoginToken(token);

  const { data: row, error } = await supabase
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
  const { error: burnError } = await supabase
    .from("member_login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null);
  if (burnError) {
    console.error("[member/auth/verify] failed to mark token used:", burnError);
    return fail("server");
  }

  // Resolve the member(s) for this email.
  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("member_id, team_id, display_name")
    .ilike("email", row.email);

  if (memberError) {
    console.error("[member/auth/verify] member lookup failed:", memberError);
    return fail("server");
  }
  if (!members || members.length === 0) return fail("nomember");

  // Exactly one member → sign in.
  if (members.length === 1) {
    const m = members[0];
    const jwt = await signSession({ member_id: m.member_id, team_id: m.team_id });
    const res = NextResponse.redirect(`${APP_URL}/me`);
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions(SESSION_COOKIE_MAX_AGE));
    return res;
  }

  // Several members share this email (multi-team) → chooser. Attach team names.
  const teamIds = Array.from(new Set(members.map((m) => m.team_id)));
  const { data: teams } = await supabase
    .from("teams")
    .select("team_id, team_name")
    .in("team_id", teamIds);
  const teamName = new Map((teams ?? []).map((t) => [t.team_id, t.team_name]));

  const candidates: PreSessionCandidate[] = members.map((m) => ({
    member_id: m.member_id,
    team_id: m.team_id,
    team_name: teamName.get(m.team_id) ?? "Your team",
    display_name: m.display_name,
  }));

  const preJwt = await signPreSession({ email: row.email, candidates });
  const res = NextResponse.redirect(`${APP_URL}/member-login/select-team`);
  res.cookies.set(PRESESSION_COOKIE, preJwt, sessionCookieOptions(PRESESSION_COOKIE_MAX_AGE));
  return res;
}
