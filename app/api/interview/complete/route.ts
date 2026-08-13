import { NextRequest, NextResponse } from "next/server";
import { requireInterviewAccess } from "@/lib/interviewAccess";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = body?.member_id;
  if (typeof memberId !== "string" || !memberId) {
    return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  }
  const auth = await requireInterviewAccess(request, { memberId });
  if (!auth.ok) return auth.response;

  const [{ data: member, error: memberError }, { data: acknowledgement, error: acknowledgementError }] = await Promise.all([
    supabaseAdmin.from("members").select("member_id, team_id, status").eq("member_id", auth.value.memberId).maybeSingle(),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("member_id, privacy_notice_version")
      .eq("member_id", auth.value.memberId)
      .maybeSingle(),
  ]);
  if (memberError || acknowledgementError) return NextResponse.json({ error: "Unable to complete interview." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  if (!acknowledgement || acknowledgement.privacy_notice_version !== PRIVACY_NOTICE_VERSION) {
    return NextResponse.json({ error: "Please acknowledge the current privacy notice before submitting." }, { status: 409 });
  }
  if (member.status === "opted_out") return NextResponse.json({ error: "This participant has withdrawn." }, { status: 410 });

  const [statementsRes, responsesRes, purposeRes, rosterRes, coordinationRes] = await Promise.all([
    supabaseAdmin.from("ps_statements").select("statement_id", { count: "exact", head: true }),
    supabaseAdmin.from("ps_responses").select("id", { count: "exact", head: true }).eq("member_id", auth.value.memberId).eq("round", 1),
    supabaseAdmin.from("purpose_responses").select("id", { count: "exact", head: true }).eq("member_id", auth.value.memberId),
    supabaseAdmin
      .from("members")
      .select("member_id", { count: "exact", head: true })
      .eq("team_id", member.team_id)
      .neq("status", "opted_out"),
    supabaseAdmin.from("coordination_ratings").select("id", { count: "exact", head: true }).eq("member_id", auth.value.memberId),
  ]);
  if ([statementsRes, responsesRes, purposeRes, rosterRes, coordinationRes].some((result) => result.error)) {
    return NextResponse.json({ error: "Unable to verify assessment completion." }, { status: 500 });
  }
  const requiredStatements = statementsRes.count ?? 0;
  const completedStatements = responsesRes.count ?? 0;
  const requiredCoordination = Math.max(0, (rosterRes.count ?? 1) - 1);
  const completedCoordination = coordinationRes.count ?? 0;
  if (
    completedStatements !== requiredStatements ||
    (purposeRes.count ?? 0) < 1 ||
    completedCoordination < requiredCoordination
  ) {
    return NextResponse.json(
      {
        error: "Please complete all required assessment steps before submitting.",
        required_statements: requiredStatements,
        completed_statements: completedStatements,
        required_coordination: requiredCoordination,
        completed_coordination: completedCoordination,
      },
      { status: 409 }
    );
  }

  const completedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("members")
    .update({
      status: "complete",
      completed_at: completedAt,
      phase1_resume_step: null,
      phase1_return_to_review: false,
    })
    .eq("member_id", auth.value.memberId);
  if (error) return NextResponse.json({ error: "Unable to complete interview." }, { status: 500 });
  return NextResponse.json({ ok: true, completed_at: completedAt }, { headers: { "Cache-Control": "no-store" } });
}
