import { NextRequest, NextResponse } from "next/server";
import {
  verifyPreSession,
  signSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  PRESESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
} from "@/lib/memberSession";

// GET /api/member/auth/select
// Returns the team candidates from the pre-session cookie, for the chooser UI.
export async function GET(req: NextRequest) {
  const pre = await verifyPreSession(req.cookies.get(PRESESSION_COOKIE)?.value);
  if (!pre) {
    return NextResponse.json({ error: "No pending sign-in." }, { status: 401 });
  }
  // Don't leak member_ids to the client; the chooser only needs to show teams.
  return NextResponse.json({
    candidates: pre.candidates.map((c) => ({
      team_id: c.team_id,
      team_name: c.team_name,
      display_name: c.display_name,
    })),
  });
}

// POST /api/member/auth/select  { team_id }
// Completes a multi-team sign-in: validates the chosen team is one of the
// pre-session's candidates, then mints the full member session.
export async function POST(req: NextRequest) {
  const pre = await verifyPreSession(req.cookies.get(PRESESSION_COOKIE)?.value);
  if (!pre) {
    return NextResponse.json({ error: "No pending sign-in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const teamId: unknown = body?.team_id;
  if (typeof teamId !== "string") {
    return NextResponse.json({ error: "team_id is required." }, { status: 400 });
  }

  const chosen = pre.candidates.find((c) => c.team_id === teamId);
  if (!chosen) {
    return NextResponse.json({ error: "That team isn't one of your options." }, { status: 400 });
  }

  const jwt = await signSession({
    member_id: chosen.member_id,
    team_id: chosen.team_id,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions(SESSION_COOKIE_MAX_AGE));
  // Pre-session done — clear it.
  res.cookies.set(PRESESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
