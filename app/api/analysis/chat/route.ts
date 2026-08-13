import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { PART2_SYSTEM_PROMPT } from "@/prompts/part2_analytics";
import { PRIVACY_NOTICE_VERSION, redactTextForExternalProcessing } from "@/lib/privacy";
import { requireTeamOwner } from "@/lib/requestAuth";
import {
  artifactMatchesTier1,
  currentTier1Provenance,
  RECOMPUTE_REQUIRED_MESSAGE,
} from "@/lib/analysisProvenance";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

// Prepended to the conversation, after the data package. Keeps the model
// collaborative: the SOP shapes the proposed plan, but the consultant leads.
const CONSULTANT_NOTE =
  "You are now in conversation with the consultant about this analysis. The SOP guides your " +
  "PROPOSED focus and feedback-round plan, but the consultant may legitimately choose a different " +
  "rung, a different focus, or ask questions entirely outside the SOP. Follow their lead. If they " +
  "choose a different priority rung than you proposed, work with it — help them think through what " +
  "the feedback round would look like for that choice. Stay concise (3-5 sentences default).";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  let teamId: string;
  let messages: ChatMessage[];
  try {
    const body = await req.json();
    teamId = body.team_id;
    messages = body.messages;
    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json({ error: "team_id required" }, { status: 400 });
    }
    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const auth = await requireTeamOwner(req, teamId);
  if (!auth.ok) return auth.response;

  try {
    return await runChat(teamId, messages);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/chat] unexpected error:", err);
    return NextResponse.json({ error: "unexpected_error", detail: msg }, { status: 500 });
  }
}

async function runChat(teamId: string, messages: ChatMessage[]): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  // ── Analysis row — must already have Tier 1 ─────────────────────────────────
  const { data: analysisRow, error: analysisError } = await supabaseAdmin
    .from("analysis")
    .select("*")
    .eq("team_id", teamId)
    .maybeSingle();

  if (analysisError) {
    return NextResponse.json({ error: "db_error", detail: analysisError.message }, { status: 500 });
  }
  if (!analysisRow || !analysisRow.tier1_json) {
    return NextResponse.json({ error: "Run Tier 1 analysis first" }, { status: 400 });
  }
  const tier1Provenance = currentTier1Provenance(analysisRow.tier1_json);
  if (!tier1Provenance) {
    return NextResponse.json(
      { error: RECOMPUTE_REQUIRED_MESSAGE, code: "analysis_recompute_required" },
      { status: 409 }
    );
  }

  // ── Team context ────────────────────────────────────────────────────────────
  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("team_id", teamId)
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "team_not_found" }, { status: 404 });
  }

  const teamContext = {
    team_name: team.team_name,
    industry: team.industry,
    known_sensitivities: team.known_sensitivities,
  };

  // ── Members (for private_code + privacy flag) ───────────────────────────────
  const [membersResult, privacyResult] = await Promise.all([
    supabaseAdmin
      .from("members")
      .select("*")
      .eq("team_id", teamId)
      .eq("status", "complete"),
    supabaseAdmin
      .from("member_privacy_acknowledgements")
      .select("member_id, verbatim_preference")
      .eq("team_id", teamId)
      .eq("privacy_notice_version", PRIVACY_NOTICE_VERSION)
      .not("acknowledged_at", "is", null),
  ]);

  if (membersResult.error || privacyResult.error) {
    return NextResponse.json(
      { error: "db_error", detail: membersResult.error?.message ?? privacyResult.error?.message },
      { status: 500 }
    );
  }

  const privacyByMemberId = new Map((privacyResult.data ?? []).map((record) => [record.member_id, record]));
  const members = (membersResult.data ?? []).filter((member) => privacyByMemberId.has(member.member_id));
  const memberIds = members.map((member) => member.member_id);
  const memberById = new Map(members.map((member) => [member.member_id, member]));

  // ── Qualitative material + per-item PS detail ───────────────────────────────
  // Phase 2 is quantitative-only: the interview coding/clustering pipeline was
  // retired, so there is no coded qualitative material. The model's grounding is
  // the per-statement PS detail (below), the purpose statements, and the Tier 1
  // metrics inside tier1_json. No fish_responses, no interview clusters.
  const [purposeRes, stmtRes, psRes] = await Promise.all([
    supabaseAdmin.from("purpose_responses").select("*").eq("team_id", teamId).in("member_id", memberIds),
    supabaseAdmin.from("ps_statements").select("*").order("statement_id", { ascending: true }),
    supabaseAdmin.from("ps_responses").select("*").eq("team_id", teamId).eq("round", 1).in("member_id", memberIds),
  ]);

  if (purposeRes.error) {
    return NextResponse.json({ error: "db_error", detail: purposeRes.error.message }, { status: 500 });
  }
  if (stmtRes.error) {
    return NextResponse.json({ error: "db_error", detail: stmtRes.error.message }, { status: 500 });
  }
  if (psRes.error) {
    return NextResponse.json({ error: "db_error", detail: psRes.error.message }, { status: 500 });
  }

  const purposeStatements = (purposeRes.data ?? []).map((r) => {
    const m = memberById.get(r.member_id);
    const shareVerbatim = privacyByMemberId.get(r.member_id)?.verbatim_preference === "verbatim";
    return {
      private_code: m?.private_code ?? "unknown",
      kept_private: !shareVerbatim,
      purpose_text: shareVerbatim ? r.purpose_text : "[Participant chose summaries only.]",
    };
  });

  // Each PS statement with its full wording/zone, plus every member's response.
  const psResponses = psRes.data ?? [];
  const psItems = (stmtRes.data ?? []).map((s) => ({
    statement_id: s.statement_id,
    zone: s.zone,
    zone_name: s.zone_name,
    statement_text: s.statement_text,
    responses: psResponses
      .filter((r) => r.statement_id === s.statement_id)
      .map((r) => ({
        private_code: memberById.get(r.member_id)?.private_code ?? "unknown",
        label: r.label,
        response_value: r.response_value,
      })),
  }));

  // ── Assemble the data package for the model ─────────────────────────────────
  // Includes the proposed Tier 2 interpretation so the consultant can discuss it.
  const dataPackage = {
    instruction:
      "Below is the full Tier 1 computed metrics package, the team context, all qualitative material, " +
      "and your previously proposed Tier 2 interpretation. Members marked kept_private kept their words " +
      "private from the team — use their text for reasoning only, never quote or attribute it.",
    team_context: teamContext,
    computed_metrics_tier1: analysisRow.tier1_json,
    ps_items: psItems,
    qualitative_material: {
      purpose_statements: purposeStatements,
    },
    // An earlier Tier 2 read can remain stored for retention, but it must not
    // be sent back to a model once a new current-consent computation exists.
    proposed_interpretation_tier2: artifactMatchesTier1(analysisRow.tier2_json, tier1Provenance)
      ? analysisRow.tier2_json
      : null,
  };

  const { data: identities } = await supabaseAdmin
    .from("member_identity")
    .select("display_name")
    .eq("team_id", teamId);
  const knownNames = (identities ?? []).map((identity) => identity.display_name);
  const dataPackageText = redactTextForExternalProcessing(JSON.stringify(dataPackage, null, 2), knownNames);

  // The context block is prepended to the conversation: the data package, then
  // the consultant-conversation note.
  const contextBlock = `${dataPackageText}\n\n${CONSULTANT_NOTE}`;

  // Fold the context into the first user turn so the message sequence stays clean.
  const convo: ChatMessage[] = messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .slice(-20)
    .map((message) => ({ role: message.role, content: redactTextForExternalProcessing(message.content.slice(0, 6000), knownNames) }));
  if (convo.length > 0 && convo[0].role === "user") {
    convo[0] = { role: "user", content: `${contextBlock}\n\n---\n\nConsultant: ${convo[0].content}` };
  } else {
    convo.unshift({ role: "user", content: contextBlock });
  }

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey });

  let reply: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: PART2_SYSTEM_PROMPT,
      messages: convo,
    });
    reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/chat] Anthropic call failed:", err);
    return NextResponse.json({ error: "ai_call_failed", detail: msg }, { status: 502 });
  }

  if (!reply) {
    return NextResponse.json({ error: "ai_empty_response" }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
