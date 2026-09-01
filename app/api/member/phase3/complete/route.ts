import { NextRequest, NextResponse } from "next/server";
import { requirePhase3Member } from "@/lib/requestAuth";
import { missingPhase3SubmissionFields } from "@/lib/phase3Submission";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const auth = await requirePhase3Member(request, undefined, { allowCompleted: true });
  if (!auth.ok) return auth.response;
  const { member_id: memberId, team_id: teamId } = auth.value.session;

  // Treat retries as idempotent. The member may have lost the final response
  // after the completion marker was committed.
  if (auth.value.phase3CompletedAt) {
    return NextResponse.json({ ok: true, completed_at: auth.value.phase3CompletedAt });
  }

  const [behaviorRes, contextRes, conversationRes, pulseRes] = await Promise.all([
    supabaseAdmin.from("member_behaviors").select("bucket").eq("member_id", memberId).eq("team_id", teamId),
    supabaseAdmin.from("phase3_context_responses").select("frequency, commitment, synchronicity").eq("member_id", memberId).eq("team_id", teamId).maybeSingle(),
    supabaseAdmin.from("phase3_conversation_messages").select("kind, state").eq("member_id", memberId).eq("team_id", teamId),
    supabaseAdmin.from("phase3_pulse_checks").select("read_key").eq("member_id", memberId).eq("team_id", teamId),
  ]);
  if (behaviorRes.error || contextRes.error || conversationRes.error || pulseRes.error) {
    return NextResponse.json({ error: "Unable to verify all saved activity responses." }, { status: 500 });
  }

  const report = auth.value.phase3Report;
  const missing = missingPhase3SubmissionFields({
    includeStories: report.include_stories !== false,
    includePurpose: report.include_shared_purpose === true,
    behaviorBuckets: (behaviorRes.data ?? []).map((behavior) => behavior.bucket),
    context: contextRes.data,
    conversations: conversationRes.data ?? [],
    pulseKeys: (pulseRes.data ?? []).map((row) => row.read_key),
  });

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Please finish and save ${missing.join(", ")} before submitting.`,
        code: "phase3_incomplete",
        missing,
      },
      { status: 409 }
    );
  }

  const completedAt = new Date().toISOString();
  const { data: completedMember, error } = await supabaseAdmin
    .from("members")
    .update({ phase3_completed_at: completedAt })
    .eq("member_id", memberId)
    .eq("team_id", teamId)
    .select("member_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to mark this activity complete." }, { status: 500 });
  if (!completedMember) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  return NextResponse.json({ ok: true, completed_at: completedAt });
}
