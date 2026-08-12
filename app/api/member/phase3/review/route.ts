import { NextRequest, NextResponse } from "next/server";
import { requireAcknowledgedMember } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

// Returns only the signed-in participant's Phase 3 contribution for the review
// screen and download. It is intentionally not a team-wide story/behaviour API.
export async function GET(request: NextRequest) {
  const auth = await requireAcknowledgedMember(request);
  if (!auth.ok) return auth.response;
  const { member_id: memberId, team_id: teamId } = auth.value.session;

  const [stories, behaviors, context] = await Promise.all([
    supabaseAdmin.from("member_stories").select("*").eq("member_id", memberId).eq("team_id", teamId).order("story_order", { ascending: true }),
    supabaseAdmin.from("member_behaviors").select("*").eq("member_id", memberId).eq("team_id", teamId).order("created_at", { ascending: true }),
    supabaseAdmin.from("phase3_context_responses").select("*").eq("member_id", memberId).eq("team_id", teamId).maybeSingle(),
  ]);
  if (stories.error || behaviors.error || context.error) {
    return NextResponse.json({ error: "Unable to load your saved contribution." }, { status: 500 });
  }
  return NextResponse.json({
    stories: stories.data ?? [],
    behaviors: behaviors.data ?? [],
    context: context.data ?? null,
  });
}
