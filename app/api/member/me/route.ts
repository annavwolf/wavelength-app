import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifySession, SESSION_COOKIE } from "@/lib/memberSession";

// GET /api/member/me
// The single source of member-facing data. Verifies the session cookie
// server-side, resolves the member_id from it, and returns ONLY that member's
// own Phase 1 data — every query is scoped by member_id. The browser never
// queries this data directly (RLS is off app-wide), so this route is the
// access-control boundary for member data.
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { member_id } = session;

  const [
    memberRes,
    statementsRes,
    responsesRes,
    interviewRes,
    purposeRes,
    coordinationRes,
  ] = await Promise.all([
    supabase.from("members").select("*").eq("member_id", member_id).single(),
    supabase.from("ps_statements").select("*").order("statement_id", { ascending: true }),
    supabase
      .from("ps_responses")
      .select("*")
      .eq("member_id", member_id)
      .eq("round", 1)
      .order("statement_id", { ascending: true }),
    supabase
      .from("ps_interview_responses")
      .select("*")
      .eq("member_id", member_id)
      .order("statement_id", { ascending: true }),
    supabase
      .from("purpose_responses")
      .select("*")
      .eq("member_id", member_id)
      .maybeSingle(),
    supabase
      .from("coordination_ratings")
      .select("*")
      .eq("member_id", member_id),
  ]);

  if (memberRes.error || !memberRes.data) {
    console.error("[member/me] member lookup failed:", memberRes.error);
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const member = memberRes.data;

  const { data: team } = await supabase
    .from("teams")
    .select("team_id, team_name")
    .eq("team_id", member.team_id)
    .maybeSingle();

  // The member's own view: only the fields the profile needs. Own data is shown
  // in full (privacy flags gate what OTHERS see, not the member themselves), but
  // we still return the flags so the profile can show the member their choices.
  return NextResponse.json({
    member: {
      member_id: member.member_id,
      display_name: member.display_name,
      email: member.email,
      role: member.role,
      status: member.status,
      share_name_with_team: member.share_name_with_team,
      share_verbatim_with_team: member.share_verbatim_with_team,
    },
    team: team ?? null,
    statements: statementsRes.data ?? [],
    ps_responses: responsesRes.data ?? [],
    interview_responses: interviewRes.data ?? [],
    purpose_response: purposeRes.data ?? null,
    coordination_ratings: coordinationRes.data ?? [],
  });
}
