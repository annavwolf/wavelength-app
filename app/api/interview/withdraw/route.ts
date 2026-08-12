import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const memberId = body?.member_id;
  if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 });

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("member_id, team_id")
    .eq("member_id", memberId)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Unable to process withdrawal." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Participant not found." }, { status: 404 });

  const { data: analysis } = await supabaseAdmin
    .from("analysis")
    .select("tier1_json, tier2_json, phase3_report_json, phase4_selfserve_json")
    .eq("team_id", member.team_id)
    .maybeSingle();
  const reportWasGenerated = Boolean(
    analysis?.tier1_json || analysis?.tier2_json || analysis?.phase3_report_json || analysis?.phase4_selfserve_json
  );

  const deletions = await Promise.all([
    supabaseAdmin.from("ps_responses").delete().eq("member_id", memberId),
    supabaseAdmin.from("purpose_responses").delete().eq("member_id", memberId),
    supabaseAdmin.from("coordination_ratings").delete().eq("member_id", memberId),
    supabaseAdmin.from("missing_member_flags").delete().eq("reported_by_member_id", memberId),
    supabaseAdmin.from("member_questions").delete().eq("member_id", memberId),
    supabaseAdmin.from("ps_interview_responses").delete().eq("member_id", memberId),
    supabaseAdmin.from("interview_labels").delete().eq("member_id", memberId),
  ]);
  const deletionError = deletions.find((result) => result.error)?.error;
  if (deletionError) return NextResponse.json({ error: "Unable to delete all interview responses." }, { status: 500 });

  const [memberResult, auditResult] = await Promise.all([
    supabaseAdmin.from("members").update({ status: "opted_out" }).eq("member_id", memberId),
    supabaseAdmin.from("member_withdrawals").insert({
      member_id: memberId,
      team_id: member.team_id,
      scope: "phase1",
      report_was_generated: reportWasGenerated,
    }),
  ]);
  if (memberResult.error || auditResult.error) return NextResponse.json({ error: "Responses were deleted, but the withdrawal record could not be finalised." }, { status: 500 });
  return NextResponse.json({ ok: true, report_was_generated: reportWasGenerated });
}
