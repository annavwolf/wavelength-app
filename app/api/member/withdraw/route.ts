import { NextRequest, NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

const SCOPES = ["stories", "behaviors", "everything"] as const;
type Scope = (typeof SCOPES)[number];

export async function POST(request: NextRequest) {
  const auth = await requireMemberSession(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const scope = body?.scope as Scope;
  if (!SCOPES.includes(scope)) return NextResponse.json({ error: "Invalid withdrawal scope." }, { status: 400 });
  // The complete Phase 3 contribution is a materially broader deletion than
  // withdrawing one kind of response. Enforce the same deliberate phrase on
  // the server that the interface asks the participant to type.
  if (scope === "everything" && String(body?.confirmation ?? "").trim().toUpperCase() !== "WITHDRAW") {
    return NextResponse.json({ error: "Type WITHDRAW to confirm removal of your entire contribution." }, { status: 400 });
  }
  const { member_id: memberId, team_id: teamId } = auth.value.session;

  const { data: analysis } = await supabaseAdmin
    .from("analysis")
    .select("phase3_report_json, phase4_selfserve_json")
    .eq("team_id", teamId)
    .maybeSingle();
  const reportWasGenerated = Boolean(analysis?.phase3_report_json || analysis?.phase4_selfserve_json);
  const jobs: PromiseLike<{ error: unknown }> [] = [];
  if (scope === "stories") {
    jobs.push(supabaseAdmin.from("member_stories").delete().eq("member_id", memberId).eq("team_id", teamId));
    jobs.push(supabaseAdmin.from("phase3_conversation_messages").delete().eq("member_id", memberId).eq("team_id", teamId).eq("kind", "story"));
    // The impact and frequency reflection belong to the story portion of the
    // activity. Preserve commitments and meeting preferences in the same row.
    jobs.push(supabaseAdmin.from("phase3_conversation_messages").delete().eq("member_id", memberId).eq("team_id", teamId).eq("kind", "impact"));
    jobs.push(supabaseAdmin.from("phase3_context_responses").update({ impact_text: null, frequency: null }).eq("member_id", memberId).eq("team_id", teamId));
  }
  if (scope === "behaviors" || scope === "everything") {
    jobs.push(supabaseAdmin.from("member_behaviors").delete().eq("member_id", memberId).eq("team_id", teamId));
  }
  if (scope === "everything") {
    jobs.push(supabaseAdmin.from("member_stories").delete().eq("member_id", memberId).eq("team_id", teamId));
    // Delete every saved conversation kind, rather than relying on today's
    // story/impact list if a future activity adds another conversation.
    jobs.push(supabaseAdmin.from("phase3_conversation_messages").delete().eq("member_id", memberId).eq("team_id", teamId));
    jobs.push(supabaseAdmin.from("phase3_context_responses").delete().eq("member_id", memberId).eq("team_id", teamId));
    jobs.push(supabaseAdmin.from("phase3_pulse_checks").delete().eq("member_id", memberId).eq("team_id", teamId));
    // This is a Phase 3 contribution withdrawal, not a withdrawal from the
    // participant's completed Phase 1 assessment or the beta as a whole.
    jobs.push(supabaseAdmin.from("members").update({ phase3_completed_at: null }).eq("member_id", memberId));
  } else if (scope === "behaviors") {
    // Behaviours are the activity's core deliverable, so removing them means
    // the prior completion marker must no longer imply a completed activity.
    jobs.push(supabaseAdmin.from("members").update({ phase3_completed_at: null }).eq("member_id", memberId));
  }
  const results = await Promise.all(jobs);
  if (results.some((result) => result.error)) return NextResponse.json({ error: "Unable to withdraw all requested data." }, { status: 500 });
  const { error: auditError } = await supabaseAdmin.from("member_withdrawals").insert({
    member_id: memberId,
    team_id: teamId,
    scope,
    report_was_generated: reportWasGenerated,
  });
  if (auditError) return NextResponse.json({ error: "Withdrawal completed, but its audit record could not be saved." }, { status: 500 });
  return NextResponse.json({ ok: true, report_was_generated: reportWasGenerated });
}
