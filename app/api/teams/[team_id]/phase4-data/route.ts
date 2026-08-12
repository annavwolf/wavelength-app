import { NextRequest, NextResponse } from "next/server";
import { requireTeamOwner } from "@/lib/requestAuth";
import { supabaseAdmin } from "@/lib/supabase";

// Consultant-only supporting data for the Phase 4 screen. Free-text fields are
// projected before they enter the browser: a summary-only participant's exact
// words are never shipped merely because the UI happens to hide them.
export async function GET(request: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const { team_id: teamId } = await params;
  const auth = await requireTeamOwner(request, teamId);
  if (!auth.ok) return auth.response;

  const [contextRes, pulseRes, behaviorRes, storiesRes, privacyRes] = await Promise.all([
    supabaseAdmin.from("phase3_context_responses").select("*").eq("team_id", teamId),
    supabaseAdmin.from("phase3_pulse_checks").select("member_id, read_key, accuracy_rating, comment").eq("team_id", teamId),
    supabaseAdmin.from("member_behaviors").select("id, member_id, text, bucket").eq("team_id", teamId).order("created_at", { ascending: true }),
    supabaseAdmin.from("member_stories").select("situation_tag").eq("team_id", teamId),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("member_id, verbatim_preference")
      .eq("team_id", teamId),
  ]);
  if (contextRes.error || pulseRes.error || behaviorRes.error || storiesRes.error || privacyRes.error) {
    return NextResponse.json({ error: "Unable to load Phase 4 data." }, { status: 500 });
  }
  const canQuote = new Set(
    (privacyRes.data ?? [])
      .filter((record) => record.verbatim_preference === "verbatim")
      .map((record) => record.member_id)
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
