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
// Identified to the client by array position only — member_ids aren't leaked.
export async function GET(req: NextRequest) {
  const pre = await verifyPreSession(req.cookies.get(PRESESSION_COOKIE)?.value);
  if (!pre) {
    return NextResponse.json({ error: "No pending sign-in." }, { status: 401 });
  }
  return NextResponse.json({
    candidates: pre.candidates.map((c) => ({
      team_name: c.team_name,
      display_name: c.display_name,
      private_code: c.private_code,
      role: c.role,
    })),
  });
}

// POST /api/member/auth/select  { index }
// Completes a multi-team sign-in. Keyed by candidate INDEX (not team_id), since
// one email can be on several members in the SAME team — team_id isn't unique.
export async function POST(req: NextRequest) {
  const pre = await verifyPreSession(req.cookies.get(PRESESSION_COOKIE)?.value);
  if (!pre) {
    return NextResponse.json({ error: "No pending sign-in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const index: unknown = body?.index;
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= pre.candidates.length
  ) {
    return NextResponse.json({ error: "Invalid selection." }, { status: 400 });
  }

  const chosen = pre.candidates[index];

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
