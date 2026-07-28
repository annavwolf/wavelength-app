import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { PART2_SYSTEM_PROMPT } from "@/prompts/part2_analytics";
import { MODELS } from "@/lib/models";
import type { Json } from "@/types/database";

const MODEL = MODELS.interpret;
// Zone read + shared-purpose read + focus hypothesis. 6000 tokens is ample.
const MAX_TOKENS = 6000;

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

  // ── Team context (only thing not already inside tier1_json) ─────────────────
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

  // ── Assemble the data package for the model ─────────────────────────────────
  // tier1_json carries zones, per-statement detail, shared-purpose classification,
  // purpose passthrough (with the share_verbatim flag), and the networks.
  const dataPackage = {
    instruction:
      "Below is the full Tier 1 computed metrics package and the team context. Members whose " +
      "purpose text is marked share_verbatim:false kept their words private from the team — use them " +
      "for reasoning only, never quote or attribute them, even to the consultant. Return ONLY the JSON " +
      "object specified in your instructions.",
    team_context: teamContext,
    computed_metrics_tier1: analysisRow.tier1_json,
  };

  const userMessage = JSON.stringify(dataPackage, null, 2);

  // ── Call Anthropic (written reads + focus hypothesis only) ──────────────────
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

  interpretation.generated_at = new Date().toISOString();

  // ── Save to analysis table ──────────────────────────────────────────────────
  // tier2_json is the single source of truth for the interpretation: the PS zone
  // read, shared-purpose read, focus hypothesis, and the member-facing draft.
  const { error: updateError } = await supabase
    .from("analysis")
    .update({
      tier2_json: interpretation as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("team_id", teamId);

  if (updateError) {
    console.error("[analysis/interpret] save failed:", updateError);
    // The interpretation succeeded — return it so the consultant still sees the read,
    // with a flag that persistence failed (most likely the tier2_json column is missing).
    return NextResponse.json(
      { ...interpretation, _save_warning: updateError.message },
      { status: 200 }
    );
  }

  return NextResponse.json(interpretation);
}
