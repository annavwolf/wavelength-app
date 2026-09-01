import { NextRequest, NextResponse } from "next/server";
import { requireEarlyAccessConsultant, requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  currentPrivacyParticipantIds,
  getCurrentPrivacyParticipants,
} from "@/lib/currentPrivacyParticipants";

// Consultant-only supporting data for the Phase 4 screen. Every query is
// constrained to participants who acknowledge the current notice; then
// free-text fields are projected before they enter the browser so a
// summary-only participant's exact words are never shipped merely because the
// UI happens to hide them.
export async function GET(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;
  const earlyAccess = await requireEarlyAccessConsultant(auth.value.userId);
  if (!earlyAccess.ok) return earlyAccess.response;

  const privacyParticipants = await getCurrentPrivacyParticipants(teamId);
  const currentMemberIds = currentPrivacyParticipantIds(privacyParticipants);
  if (currentMemberIds.length === 0) {
    return NextResponse.json({ context: [], pulse_checks: [], behaviors: [], story_tags: [] });
  }

  const { data: completedMembers, error: completionError } = await supabaseAdmin
    .from("members")
    .select("member_id")
    .eq("team_id", teamId)
    .in("member_id", currentMemberIds)
    .not("phase3_completed_at", "is", null);
  if (completionError) {
    return NextResponse.json({ error: "Unable to verify Phase 3 submissions." }, { status: 500 });
  }
  const completedMemberIdSet = new Set((completedMembers ?? []).map((member) => member.member_id));
  const completedPrivacyParticipants = privacyParticipants.filter((participant) =>
    completedMemberIdSet.has(participant.memberId)
  );
  const memberIds = currentPrivacyParticipantIds(completedPrivacyParticipants);
  if (memberIds.length === 0) {
    return NextResponse.json({ context: [], pulse_checks: [], behaviors: [], story_tags: [] });
  }

  const [contextRes, pulseRes, behaviorRes, storiesRes] = await Promise.all([
    supabaseAdmin.from("phase3_context_responses").select("*").eq("team_id", teamId).in("member_id", memberIds),
    supabaseAdmin.from("phase3_pulse_checks").select("member_id, read_key, accuracy_rating, comment").eq("team_id", teamId).in("member_id", memberIds),
    supabaseAdmin.from("member_behaviors").select("id, member_id, text, bucket").eq("team_id", teamId).in("member_id", memberIds).order("created_at", { ascending: true }),
    supabaseAdmin.from("member_stories").select("situation_tag").eq("team_id", teamId).in("member_id", memberIds),
  ]);
  if (contextRes.error || pulseRes.error || behaviorRes.error || storiesRes.error) {
    return NextResponse.json({ error: "Unable to load Phase 4 data." }, { status: 500 });
  }
  const canQuote = new Set(
    completedPrivacyParticipants
      .filter((participant) => participant.verbatimPreference === "verbatim")
      .map((participant) => participant.memberId)
  );
  const withheld = "[Participant chose summaries only.]";
  return NextResponse.json({
    // The browser receives only the fields the screen needs, never the member
    // or team identifiers that could link an anonymous excerpt back to a name.
    context: (contextRes.data ?? []).map((row) => {
      const verbatimAllowed = canQuote.has(row.member_id);
      return {
        frequency: row.frequency,
        impact_text: verbatimAllowed ? row.impact_text : row.impact_text ? withheld : null,
        verbatim_allowed: verbatimAllowed,
      };
    }),
    pulse_checks: (pulseRes.data ?? []).map((row) => {
      const verbatimAllowed = canQuote.has(row.member_id);
      return {
        read_key: row.read_key,
        accuracy_rating: row.accuracy_rating,
        comment: verbatimAllowed ? row.comment : row.comment ? withheld : null,
        verbatim_allowed: verbatimAllowed,
      };
    }),
    behaviors: (behaviorRes.data ?? []).map((row, index) => {
      const verbatimAllowed = canQuote.has(row.member_id);
      return {
        id: `behavior-${index + 1}`,
        bucket: row.bucket,
        text: verbatimAllowed ? row.text : withheld,
        verbatim_allowed: verbatimAllowed,
      };
    }),
    story_tags: storiesRes.data ?? [],
  });
}
