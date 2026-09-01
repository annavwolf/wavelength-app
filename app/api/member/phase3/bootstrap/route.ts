import { NextRequest, NextResponse } from "next/server";
import { requirePhase3Member } from "@/lib/requestAuth";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase";
import type { Phase3ReportJson, PsStatement } from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";

// Member-safe bootstrap data for the Results & Team Agreement Activity. Keeping this on a
// scoped server route avoids exposing the team's full analysis row in the
// browser merely to resume a participant's own activity.
export async function GET(request: NextRequest) {
  const auth = await requirePhase3Member(request, undefined, { allowCompleted: true });
  if (!auth.ok) return auth.response;
  const { member_id: memberId, team_id: teamId } = auth.value.session;

  const [memberRes, progressRes, identityRes, analysisRes, contextRes, storiesRes, behaviorsRes, rosterRes, privacyRes] = await Promise.all([
    supabaseAdmin.from("members").select("member_id, team_id, status, phase3_completed_at").eq("member_id", memberId).maybeSingle(),
    // Kept separate from the required member query so deployment remains
    // backwards-compatible until migration 0033 is applied.
    supabaseAdmin.from("members").select("phase3_resume_step, phase3_reached_step").eq("member_id", memberId).maybeSingle(),
    supabaseAdmin.from("member_identity").select("display_name").eq("member_id", memberId).maybeSingle(),
    supabaseAdmin.from("analysis").select("tier1_json, tier2_json, phase3_report_json").eq("team_id", teamId).maybeSingle(),
    supabaseAdmin
      .from("phase3_context_responses")
      .select("frequency, impact_text, commitment, synchronicity")
      .eq("member_id", memberId)
      .eq("team_id", teamId)
      .maybeSingle(),
    supabaseAdmin.from("member_stories").select("id", { count: "exact", head: true }).eq("member_id", memberId).eq("team_id", teamId),
    supabaseAdmin.from("member_behaviors").select("id", { count: "exact", head: true }).eq("member_id", memberId).eq("team_id", teamId),
    supabaseAdmin.from("member_identity").select("display_name").eq("team_id", teamId).order("display_name", { ascending: true }),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("acknowledged_at, privacy_notice_version, verbatim_preference, voice_input_opt_in")
      .eq("member_id", memberId)
      .maybeSingle(),
  ]);

  if (
    memberRes.error || !memberRes.data || identityRes.error || analysisRes.error ||
    contextRes.error || storiesRes.error || behaviorsRes.error || rosterRes.error || privacyRes.error
  ) {
    return NextResponse.json({ error: "Unable to load the Results & Team Agreement Activity." }, { status: 500 });
  }

  const tier1 = (analysisRes.data?.tier1_json ?? null) as Tier1Result | null;
  const tier2 = (analysisRes.data?.tier2_json ?? null) as Tier2Result | null;
  const report = auth.value.phase3Report as Phase3ReportJson;
  const focusStatementId = report?.focus_statement_id ?? tier2?.focus_hypothesis?.statement_id ?? null;
  let focusStatement: PsStatement | null = null;
  if (focusStatementId) {
    const { data, error } = await supabaseAdmin
      .from("ps_statements")
      .select("*")
      .eq("statement_id", focusStatementId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: "Unable to load the activity focus." }, { status: 500 });
    }
    focusStatement = data;
  }

  return NextResponse.json({
    member: {
      member_id: memberId,
      display_name: identityRes.data?.display_name ?? "",
      status: memberRes.data.status,
      phase3_completed_at: memberRes.data.phase3_completed_at,
      phase3_resume_step: progressRes.data?.phase3_resume_step ?? null,
      phase3_reached_step: progressRes.data?.phase3_reached_step ?? null,
    },
    privacy_acknowledgement:
      privacyRes.data?.acknowledged_at &&
      privacyRes.data.privacy_notice_version === PRIVACY_NOTICE_VERSION
        ? privacyRes.data
        : null,
    report,
    // Phase 3 only renders zone scores. Deliberately omit response-level,
    // purpose, and free-text consultant data from the member payload.
    tier1: tier1 ? { ps_zones: tier1.ps_zones } : null,
    shared_purpose_classification: tier2?.shared_purpose_read?.classification,
    focus_statement: focusStatement,
    roster_names: (rosterRes.data ?? []).map((row) => row.display_name).filter(Boolean),
    story_count: storiesRes.count ?? 0,
    behavior_count: behaviorsRes.count ?? 0,
    context: contextRes.data ?? null,
  });
}
