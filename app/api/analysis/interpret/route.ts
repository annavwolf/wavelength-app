import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { PART2_SYSTEM_PROMPT } from "@/prompts/part2_analytics";
import type { Json } from "@/types/database";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;

export async function POST(req: NextRequest) {
  let teamId: string;
  try {
    const body = await req.json();
    teamId = body.team_id;
    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json({ error: "team_id required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    return await runInterpret(teamId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/interpret] unexpected error:", err);
    return NextResponse.json({ error: "unexpected_error", detail: msg }, { status: 500 });
  }
}

async function runInterpret(teamId: string): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  // ── Analysis row — must already have Tier 1 ─────────────────────────────────
  const { data: analysisRow, error: analysisError } = await supabase
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

  // ── Team context ────────────────────────────────────────────────────────────
  const { data: team, error: teamError } = await supabase
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
    virtuality_level: team.virtuality_level,
    timezones: team.timezones,
    known_sensitivities: team.known_sensitivities,
  };

  // ── Members (for private_code + privacy flag) ───────────────────────────────
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("*")
    .eq("team_id", teamId);

  if (membersError) {
    return NextResponse.json({ error: "db_error", detail: membersError.message }, { status: 500 });
  }

  const memberById = new Map((members ?? []).map((m) => [m.member_id, m]));

  // ── Qualitative material: purpose + custom fish ─────────────────────────────
  const [purposeRes, fishRes] = await Promise.all([
    supabase.from("purpose_responses").select("*").eq("team_id", teamId),
    supabase.from("fish_responses").select("*").eq("team_id", teamId).is("fish_id", null),
  ]);

  if (purposeRes.error) {
    return NextResponse.json({ error: "db_error", detail: purposeRes.error.message }, { status: 500 });
  }
  if (fishRes.error) {
    return NextResponse.json({ error: "db_error", detail: fishRes.error.message }, { status: 500 });
  }

  const purposeStatements = (purposeRes.data ?? []).map((r) => {
    const m = memberById.get(r.member_id);
    return {
      private_code: m?.private_code ?? "unknown",
      kept_private: !(m?.share_verbatim_with_team ?? false),
      purpose_text: r.purpose_text,
    };
  });

  const customFish = (fishRes.data ?? []).map((r) => {
    const m = memberById.get(r.member_id);
    return {
      private_code: m?.private_code ?? "unknown",
      kept_private: !(m?.share_verbatim_with_team ?? false),
      severity_label: r.severity_label,
      custom_text: r.custom_text ?? "",
    };
  });

  // ── Assemble the data package for the model ─────────────────────────────────
  const dataPackage = {
    instruction:
      "Below is the full Tier 1 computed metrics package, the team context, and all qualitative material. " +
      "Members marked kept_private kept their words private from the team. Their text is included here for " +
      "your reasoning only — never quote or attribute it, even to the consultant. Return ONLY the JSON object " +
      "specified in your instructions.",
    team_context: teamContext,
    computed_metrics_tier1: analysisRow.tier1_json,
    qualitative_material: {
      purpose_statements: purposeStatements,
      custom_fish: customFish,
    },
  };

  const userMessage = JSON.stringify(dataPackage, null, 2);

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey });

  let rawText: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: PART2_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/interpret] Anthropic call failed:", err);
    return NextResponse.json({ error: "ai_call_failed", detail: msg }, { status: 502 });
  }

  if (!rawText) {
    return NextResponse.json({ error: "ai_empty_response" }, { status: 502 });
  }

  // ── Parse JSON (strip markdown fences if present) ───────────────────────────
  let jsonText = rawText;
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  let interpretation: Record<string, unknown>;
  try {
    interpretation = JSON.parse(jsonText);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysis/interpret] JSON parse failed. Raw text:", rawText);
    return NextResponse.json(
      { error: "ai_response_not_json", detail: msg, raw: rawText.slice(0, 2000) },
      { status: 502 }
    );
  }

  // ── Save to analysis table ──────────────────────────────────────────────────
  // The full interpretation lives in tier2_json (single source of truth, includes
  // headline_read, purpose_alignment, divergence_notes, focus_issue). The flat text
  // columns mirror key fields for convenience. focus_issue is intentionally left
  // untouched here — that column is used by the dashboard's priority-zone override.
  const { error: updateError } = await supabase
    .from("analysis")
    .update({
      tier2_json: interpretation as unknown as Json,
      assumptions: JSON.stringify(interpretation.assumptions ?? []),
      inout_plan: (interpretation.inout_plan as string | null) ?? null,
      deferred_for_later: JSON.stringify(interpretation.deferred_for_later ?? []),
      focus_questions: JSON.stringify(interpretation.focus_questions_for_feedback_round ?? []),
      updated_at: new Date().toISOString(),
    })
    .eq("team_id", teamId);

  if (updateError) {
    console.error("[analysis/interpret] save failed:", updateError);
    return NextResponse.json(
      { error: "save_failed", detail: updateError.message, hint: updateError.hint ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json(interpretation);
}
