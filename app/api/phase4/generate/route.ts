import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePhase4Insights } from "@/lib/phase4Insights";
import {
  currentPrivacyParticipantIds,
  getCurrentPrivacyParticipants,
} from "@/lib/currentPrivacyParticipants";
import { MODELS } from "@/lib/models";
import { missingPhase3SubmissionFields } from "@/lib/phase3Submission";
import { redactTextForExternalProcessing } from "@/lib/privacy";
import { requireEarlyAccessConsultant, requireTeamOwner } from "@/lib/requestAuth";
import {
  artifactMatchesTier1,
  currentTier1Provenance,
  RECOMPUTE_REQUIRED_MESSAGE,
  REINTERPRET_REQUIRED_MESSAGE,
  REPORT_REBUILD_REQUIRED_MESSAGE,
  withTier1Provenance,
} from "@/lib/analysisProvenance";
import type { Json, Phase3ReportJson, Phase4SelfServeJson, SituationTag } from "@/types/database";
import type { Tier1Result, Tier2Result, Networks } from "@/components/dashboard/types";

const VALID_TAGS: SituationTag[] = ["meeting", "async_chat", "email", "document", "project_task", "other"];

// Auto-tag any untagged stories for the team before generating insights.
async function autoTagStories(teamId: string, memberIds: string[]): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || memberIds.length === 0) return;

  const { data: stories } = await supabaseAdmin
    .from("member_stories")
    .select("id, story_text")
    .eq("team_id", teamId)
    .in("member_id", memberIds)
    .is("situation_tag", null);

  if (!stories || stories.length === 0) return;

  const anthropic = new Anthropic({ apiKey });
  await Promise.all(stories.map(async (story) => {
    try {
      const response = await anthropic.messages.create({
        model: MODELS.clusterNaming,
        max_tokens: 64,
        system: `Tag a team story with one context: meeting, async_chat, email, document, project_task, or other.`,
        tools: [{
          name: "tag_story",
          description: "Tag the story with one context category.",
          input_schema: {
            type: "object",
            properties: { tag: { type: "string", enum: VALID_TAGS } },
            required: ["tag"],
          },
        }],
        tool_choice: { type: "tool", name: "tag_story" },
        messages: [{ role: "user", content: `Story: "${redactTextForExternalProcessing(story.story_text).slice(0, 600)}"` }],
      });
      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "tag_story"
      );
      const tag = (toolUse?.input as { tag?: SituationTag })?.tag;
      if (tag && VALID_TAGS.includes(tag)) {
        await supabaseAdmin.from("member_stories")
          .update({ situation_tag: tag, updated_at: new Date().toISOString() })
          .eq("id", story.id);
      }
    } catch {
      // non-blocking — tagging failure doesn't stop generate
    }
  }));
}

// POST /api/phase4/generate  { team_id }
// The consultant's "Generate insights" action (spec §5). Enabled once all
// members complete Phase 3. Runs the single-stream grouping + agreement +
// clarity + distributions and saves the draft to analysis.phase4_selfserve_json.
// Preserves any prior release state; the editable exit-interview text is reset
// to fresh Otis originals on each (re)generate.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const teamId = body?.team_id as string | undefined;
  if (!teamId) return NextResponse.json({ error: "team_id required" }, { status: 400 });

  const auth = await requireTeamOwner(req, teamId);
  if (!auth.ok) return auth.response;
  const earlyAccess = await requireEarlyAccessConsultant(auth.value.userId);
  if (!earlyAccess.ok) return earlyAccess.response;

  // Phase 3 completion is the explicit Finish & Submit marker. Saved drafts
  // remain resumable, but cannot enter the agreement until the participant has
  // reviewed and submitted the whole activity.
  const privacyParticipants = await getCurrentPrivacyParticipants(teamId);
  const currentMemberIds = currentPrivacyParticipantIds(privacyParticipants);
  if (currentMemberIds.length === 0) {
    return NextResponse.json({ error: "no_current_privacy_participants" }, { status: 409 });
  }

  const membersRes = await supabaseAdmin
    .from("members")
    .select("member_id, status, phase3_completed_at")
    .eq("team_id", teamId);
  if (membersRes.error) return NextResponse.json({ error: "db_error", detail: membersRes.error.message }, { status: 500 });
  const members = membersRes.data ?? [];
  if (members.length === 0) return NextResponse.json({ error: "no_members" }, { status: 400 });

  const currentMemberIdSet = new Set(currentMemberIds);
  const currentMembers = members.filter((member) => currentMemberIdSet.has(member.member_id));

  const { data: analysis, error: aErr } = await supabaseAdmin
    .from("analysis")
    .select("tier1_json, tier2_json, phase3_report_json, phase4_selfserve_json")
    .eq("team_id", teamId)
    .maybeSingle();
  if (aErr || !analysis) {
    return NextResponse.json({ error: "Analysis not found for this team" }, { status: 404 });
  }
  const report = (analysis.phase3_report_json as Phase3ReportJson | null) ?? null;
  if (!report) {
    return NextResponse.json({ error: REPORT_REBUILD_REQUIRED_MESSAGE, code: "report_rebuild_required" }, { status: 409 });
  }

  const [behaviorRes, contextRes, conversationRes, pulseRes] = await Promise.all([
    supabaseAdmin.from("member_behaviors").select("member_id, bucket").eq("team_id", teamId).in("member_id", currentMemberIds),
    supabaseAdmin.from("phase3_context_responses").select("member_id, frequency, commitment, synchronicity").eq("team_id", teamId).in("member_id", currentMemberIds),
    supabaseAdmin.from("phase3_conversation_messages").select("member_id, kind, state").eq("team_id", teamId).in("member_id", currentMemberIds),
    supabaseAdmin.from("phase3_pulse_checks").select("member_id, read_key").eq("team_id", teamId).in("member_id", currentMemberIds),
  ]);
  if (behaviorRes.error || contextRes.error || conversationRes.error || pulseRes.error) {
    return NextResponse.json({ error: "Unable to verify the saved Phase 3 submissions." }, { status: 500 });
  }

  const participants = currentMembers.filter((m) => m.status === "complete");
  const phase3CompletedIds = new Set(
    currentMembers
      .filter((member) => {
        if (!member.phase3_completed_at) return false;
        return missingPhase3SubmissionFields({
          includeStories: report.include_stories !== false,
          includePurpose: report.include_shared_purpose === true,
          behaviorBuckets: (behaviorRes.data ?? [])
            .filter((row) => row.member_id === member.member_id)
            .map((row) => row.bucket),
          context: (contextRes.data ?? []).find((row) => row.member_id === member.member_id) ?? null,
          conversations: (conversationRes.data ?? []).filter((row) => row.member_id === member.member_id),
          pulseKeys: (pulseRes.data ?? [])
            .filter((row) => row.member_id === member.member_id)
            .map((row) => row.read_key),
        }).length === 0;
      })
      .map((member) => member.member_id)
  );
  const completedCount = participants.length > 0
    ? participants.filter((m) => phase3CompletedIds.has(m.member_id)).length
    : phase3CompletedIds.size; // fallback if no one has status=complete yet
  const totalCount = participants.length || currentMembers.length;
  const pctComplete = totalCount > 0 ? completedCount / totalCount : 0;

  // Hard block only if nobody has finished at all.
  if (completedCount === 0) {
    return NextResponse.json({ error: "members_incomplete", incomplete: totalCount, completed: 0, total: totalCount }, { status: 400 });
  }
  // Soft warning returned with the generated insights if < 80% done (caller decides how to present it).
  const lowParticipation = pctComplete < 0.8;
  const completedPrivacyParticipants = privacyParticipants.filter((participant) =>
    phase3CompletedIds.has(participant.memberId)
  );
  const completedMemberIds = currentPrivacyParticipantIds(completedPrivacyParticipants);

  const tier1Provenance = currentTier1Provenance(analysis.tier1_json);
  if (!tier1Provenance) {
    return NextResponse.json({ error: RECOMPUTE_REQUIRED_MESSAGE, code: "analysis_recompute_required" }, { status: 409 });
  }

  // Resolve the focus item: phase3_report_json wins, then tier2 focus_hypothesis.
  const tier2 = (analysis.tier2_json as unknown as Tier2Result | null) ?? null;
  if (!artifactMatchesTier1(tier2, tier1Provenance)) {
    return NextResponse.json({ error: REINTERPRET_REQUIRED_MESSAGE, code: "analysis_reinterpret_required" }, { status: 409 });
  }
  // Phase 4 is only generated from an explicitly saved Phase 3 draft. A
  // missing report must not silently fall back to Tier 2, because that would
  // bypass the consultant's release/editor checkpoint.
  if (!report || !artifactMatchesTier1(report, tier1Provenance)) {
    return NextResponse.json({ error: REPORT_REBUILD_REQUIRED_MESSAGE, code: "report_rebuild_required" }, { status: 409 });
  }
  const focusStatementId = report?.focus_statement_id ?? tier2?.focus_hypothesis?.statement_id ?? null;
  if (!focusStatementId) {
    return NextResponse.json({ error: "no_focus_item" }, { status: 400 });
  }

  const { data: statement } = await supabaseAdmin
    .from("ps_statements")
    .select("statement_text")
    .eq("statement_id", focusStatementId)
    .maybeSingle();
  const focusText = statement?.statement_text ?? tier2?.focus_hypothesis?.statement_text ?? "";

  const tier1 = (analysis.tier1_json as unknown as Tier1Result | null) ?? null;
  const networks: Networks | null = tier1?.networks ?? null;

  // Auto-tag any untagged stories so situation data is populated.
  await autoTagStories(teamId, completedMemberIds);

  let insights;
  try {
    insights = await generatePhase4Insights(
      teamId,
      focusStatementId,
      focusText,
      networks,
      completedPrivacyParticipants
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[phase4/generate] failed:", msg);
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }

  const prior = (analysis.phase4_selfserve_json as Phase4SelfServeJson | null) ?? null;
  const merged = withTier1Provenance({
    ...insights,
    artifacts: insights.artifacts?.length ? insights.artifacts : (prior?.artifacts ?? []),
    released_at: prior?.released_at ?? null,
    sent_member_ids: prior?.sent_member_ids ?? [],
  }, tier1Provenance);

  const { error: saveErr } = await supabaseAdmin
    .from("analysis")
    .update({ phase4_selfserve_json: merged as unknown as Json })
    .eq("team_id", teamId);
  if (saveErr) {
    return NextResponse.json({ error: "db_error", detail: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    // Recipient ids stay server-side. The consultant UI only needs the draft
    // content and aggregated counts, never a recipient-to-response mapping.
    insights: { ...merged, sent_member_ids: [] },
    completed_count: completedCount,
    total_count: totalCount,
    low_participation: lowParticipation,
  });
}
