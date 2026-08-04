import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/models";
import type { Phase3ContextResponseInsert } from "@/types/database";

// Phase 4 self-serve §1 — the four new Phase 3 questions.
//   phase "context"    → impact_text + frequency (§1.1)
//   phase "commitment" → commitment + commitment_comment + synchronicity (§1.2)
// Storage: one row per member/team in phase3_context_responses (upsert).
//
// The impact question follows up ONCE (§1.1) if the member addressed only one
// of the two dimensions (quality of work / welfare of the team). The check is a
// single lenient Sonnet call — on any error we accept and move on (never block).

const MODEL = MODELS.interpret;

const IMPACT_CHECK_TOOL: Anthropic.Tool = {
  name: "check_impact",
  description:
    "Decide whether a member's answer about the impact of incidents addresses BOTH the quality of the team's work AND the welfare of the team.",
  input_schema: {
    type: "object",
    properties: {
      addresses_quality: { type: "boolean", description: "True if they touched on the quality/output of the team's work." },
      addresses_welfare: { type: "boolean", description: "True if they touched on the welfare/wellbeing of the team or its people." },
      followup: {
        type: "string",
        description:
          "If exactly one dimension is missing: one short, warm follow-up (max 30 words) inviting them to say a little about the missing dimension. Empty string if both are covered or both are missing.",
      },
    },
    required: ["addresses_quality", "addresses_welfare", "followup"],
  },
};

async function impactFollowup(text: string, apiKey: string): Promise<string> {
  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `You are Otis, checking a member's answer to: "What impact do you think incidents like this have on the quality of the team's work, or on the welfare of the team?"
There are TWO dimensions: (1) quality of the team's WORK, (2) WELFARE of the team.
If the member covered only one, write ONE warm follow-up inviting the other. If they covered both, or gave nothing usable, return an empty follow-up. Be lenient — only follow up on a clear single-dimension answer.`,
      tools: [IMPACT_CHECK_TOOL],
      tool_choice: { type: "tool", name: "check_impact" },
      messages: [{ role: "user", content: `Member answer: "${text}"` }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "check_impact"
    );
    const input = toolUse?.input as { addresses_quality?: boolean; addresses_welfare?: boolean; followup?: string } | undefined;
    if (!input) return "";
    const onlyOne = (input.addresses_quality ? 1 : 0) + (input.addresses_welfare ? 1 : 0);
    return onlyOne === 1 ? (input.followup ?? "").trim() : "";
  } catch (err) {
    console.error("[phase3/context] impact check failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

// GET /api/phase3/context?member_id=&team_id=  → existing row (resume).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("member_id");
  const teamId = searchParams.get("team_id");
  if (!memberId || !teamId) return NextResponse.json({ error: "member_id and team_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("phase3_context_responses")
    .select("*")
    .eq("member_id", memberId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ context: data ?? null });
}

// POST /api/phase3/context
// Body: { member_id, team_id, phase: "context"|"commitment", ...fields, skip_followup? }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const memberId = body.member_id as string;
  const teamId = body.team_id as string;
  const phase = body.phase as string;
  if (!memberId || !teamId || !["context", "commitment"].includes(phase)) {
    return NextResponse.json({ error: "member_id, team_id, phase required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Phase3ContextResponseInsert = { member_id: memberId, team_id: teamId, updated_at: now };

  if (phase === "context") {
    const impactText = typeof body.impact_text === "string" ? body.impact_text.trim() : "";
    update.impact_text = impactText || null;
    update.frequency = (body.frequency as Phase3ContextResponseInsert["frequency"]) ?? null;

    // Follow up once, before saving, unless the member has already followed up.
    const skipFollowup = !!body.skip_followup;
    if (!skipFollowup && impactText) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const followup = apiKey ? await impactFollowup(impactText, apiKey) : "";
      if (followup) {
        // Persist what we have, but tell the client to ask the follow-up.
        await upsert(update);
        return NextResponse.json({ saved: true, followup });
      }
    }
  } else {
    update.commitment = (body.commitment as Phase3ContextResponseInsert["commitment"]) ?? null;
    update.commitment_comment =
      typeof body.commitment_comment === "string" ? body.commitment_comment.trim() || null : null;
    update.synchronicity = (body.synchronicity as Phase3ContextResponseInsert["synchronicity"]) ?? null;
  }

  const err = await upsert(update);
  if (err) return NextResponse.json({ error: "db_error", detail: err }, { status: 500 });
  return NextResponse.json({ saved: true, followup: "" });
}

async function upsert(row: Phase3ContextResponseInsert): Promise<string | null> {
  const { error } = await supabase
    .from("phase3_context_responses")
    .upsert(row, { onConflict: "member_id,team_id" });
  return error ? error.message : null;
}
