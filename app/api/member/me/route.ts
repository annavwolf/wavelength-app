import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { verifySession, SESSION_COOKIE } from "@/lib/memberSession";
import { logIdentityLookup } from "@/lib/auditLog";
import type { Phase4SelfServeJson } from "@/types/database";

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
    identityRes,
    statementsRes,
    responsesRes,
    purposeRes,
    coordinationRes,
  ] = await Promise.all([
    supabase.from("members").select("*").eq("member_id", member_id).single(),
    supabaseAdmin.from("member_identity").select("email, display_name").eq("member_id", member_id).maybeSingle(),
    supabase.from("ps_statements").select("*").order("statement_id", { ascending: true }),
    supabase
      .from("ps_responses")
      .select("*")
      .eq("member_id", member_id)
      .eq("round", 1)
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
  const identity = identityRes.data;
  void logIdentityLookup(member_id, "member_me", "member viewing own profile");

  const [{ data: team }, { data: analysisRow }, { data: phase3Ctx }] = await Promise.all([
    supabase.from("teams").select("team_id, team_name").eq("team_id", member.team_id).maybeSingle(),
    supabase
      .from("analysis")
      .select("phase3_report_json, phase4_selfserve_json")
      .eq("team_id", member.team_id)
      .maybeSingle(),
    // Phase 3 completion: member has submitted at least one behavior (core deliverable).
    supabase
      .from("member_behaviors")
      .select("id")
      .eq("member_id", member_id)
      .eq("team_id", member.team_id)
      .limit(1)
      .maybeSingle(),
  ]);

  const phase3Released = !!(
    analysisRow?.phase3_report_json &&
    (analysisRow.phase3_report_json as Record<string, unknown>).released_at
  );

  // Phase 4 self-serve results — only surfaced to the member once released, and
  // projected to the member-safe fields only. The behaviour board, distributions
  // and the consultant-only low-commitment note (spec §5 — "not shown to
  // members") are deliberately withheld from this payload.
  const p4 = (analysisRow?.phase4_selfserve_json as Phase4SelfServeJson | null) ?? null;
  const phase4Released = !!p4?.released_at;
  const phase4 = phase4Released && p4
    ? {
        agreement: p4.agreement,
        agreement_text: p4.agreement_text,
        what_to_do_next: p4.what_to_do_next,
        closing_note: p4.closing_note,
        artifacts: p4.artifacts,
        released_at: p4.released_at,
      }
    : null;

  // The member's own view: only the fields the profile needs. Own data is shown
  // in full (privacy flags gate what OTHERS see, not the member themselves), but
  // we still return the flags so the profile can show the member their choices.
  return NextResponse.json({
    member: {
      member_id: member.member_id,
      display_name: identity?.display_name ?? "",
      email: identity?.email ?? null,
      role: member.role,
      status: member.status,
      share_name_with_team: member.share_name_with_team,
      share_verbatim_with_team: member.share_verbatim_with_team,
    },
    team: team ?? null,
    phase3_released: phase3Released,
    phase3_complete: !!phase3Ctx,   // member has finished the pre-workshop activity
    phase4_released: phase4Released,
    phase4: phase4,
    statements: statementsRes.data ?? [],
    ps_responses: responsesRes.data ?? [],
    purpose_response: purposeRes.data ?? null,
    coordination_ratings: coordinationRes.data ?? [],
  });
}
