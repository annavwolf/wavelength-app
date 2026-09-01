import { NextRequest, NextResponse } from "next/server";
import { isPhase3StepId, PHASE3_STEP_IDS } from "@/lib/phase3Progress";
import { requirePhase3Member } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  const auth = await requirePhase3Member(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const step = body?.step;
  const reachedStep = body?.reached_step;
  if (!isPhase3StepId(step) || !isPhase3StepId(reachedStep)) {
    return NextResponse.json({ error: "A valid Phase 3 progress step is required." }, { status: 400 });
  }
  if (PHASE3_STEP_IDS.indexOf(reachedStep) < PHASE3_STEP_IDS.indexOf(step)) {
    return NextResponse.json({ error: "Reached step cannot be behind the current step." }, { status: 400 });
  }

  const { member_id: memberId, team_id: teamId } = auth.value.session;
  const { data, error } = await supabaseAdmin
    .from("members")
    .update({ phase3_resume_step: step, phase3_reached_step: reachedStep })
    .eq("member_id", memberId)
    .eq("team_id", teamId)
    .is("phase3_completed_at", null)
    .select("member_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Unable to save your exact place in the activity.", code: error.code },
      { status: 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "This activity is already complete." }, { status: 409 });
  return NextResponse.json({ saved: true });
}
