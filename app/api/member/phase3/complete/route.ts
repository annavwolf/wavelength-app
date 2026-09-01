import { NextRequest, NextResponse } from "next/server";
import { requireAcknowledgedMember } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const auth = await requireAcknowledgedMember(request);
  if (!auth.ok) return auth.response;
  const { member_id: memberId, team_id: teamId } = auth.value.session;

  // The client board requires at least two ALWAYS and two NEVER behaviours.
  // Recheck that invariant here so a completion marker can never be written
  // for an empty, partially saved, or directly scripted submission.
  const { data: behaviors, error: behaviorError } = await supabaseAdmin
    .from("member_behaviors")
    .select("bucket")
    .eq("member_id", memberId)
    .eq("team_id", teamId);
  if (behaviorError) {
    return NextResponse.json({ error: "Unable to verify the saved behaviours." }, { status: 500 });
  }
  const alwaysCount = (behaviors ?? []).filter((behavior) => behavior.bucket === "always").length;
  const neverCount = (behaviors ?? []).filter((behavior) => behavior.bucket === "never").length;
  if (alwaysCount < 2 || neverCount < 2) {
    return NextResponse.json(
      {
        error: "Please save at least two ALWAYS and two NEVER behaviours before submitting.",
        code: "phase3_behaviors_incomplete",
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
