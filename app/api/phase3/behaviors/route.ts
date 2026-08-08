import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/models";
import type { BehaviorBucket } from "@/types/database";

const MODEL = MODELS.interpret;
const MAX_TOKENS = 512;

// Three independent coaching checks — each "nudge once then accept + flag."
// All three run on every submit; the first failing check wins the nudge text.
// On force_save, the behavior is saved regardless with flagged = true.

const COACHING_TOOL: Anthropic.Tool = {
  name: "check_behavior",
  description: "Run three coaching checks on a member-submitted behavior entry.",
  input_schema: {
    type: "object",
    properties: {
      observability_ok: {
        type: "boolean",
        description: "True if the behavior is observable (something you could see or hear). False if it's a feeling, attitude, or vague trait.",
      },
      anonymity_ok: {
        type: "boolean",
        description: "True if the behavior is at team level (not naming or clearly identifying a specific individual).",
      },
      absence_ok: {
        type: "boolean",
        description: "True if the behavior is framed as a positive action (what people do/did), not an absence (\"no one spoke up\", \"we didn't\", \"no one ever\").",
      },
      nudge: {
        type: "string",
        description: "If any check is false: one short, warm nudge sentence (max 25 words) asking the member to rephrase. Empty string if all checks pass.",
      },
    },
    required: ["observability_ok", "anonymity_ok", "absence_ok", "nudge"],
  },
};

type CheckResult = {
  observability_ok: boolean;
  anonymity_ok: boolean;
  absence_ok: boolean;
  nudge: string;
};

async function runChecks(text: string, apiKey: string): Promise<CheckResult> {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: `You are a coaching assistant checking team-behavior entries submitted by members.
Run three checks and call check_behavior. Be lenient — only flag genuine problems.

OBSERVABILITY: A behavior is observable if someone could see or hear it happening. "Stayed quiet when they disagreed" is observable. "Felt judged" or "was unsupportive" is not — it's internal or vague. If in doubt, pass it.

ANONYMITY: A behavior is at team level if it describes what the team or people generally do. A specific name or clearly identifying detail fails. "Someone always jumps in early" is borderline but acceptable. "Sarah usually..." fails.

ABSENCE: A behavior should describe what people DO, not what they DON'T. "No one asked questions" or "we never challenged each other" is an absence. "People challenged each other directly" is a positive form. Rephrasing absences into positives makes the board more useful. If the absence is about the NEVER bucket (i.e., the member is describing a harmful behavior that should never happen), an absence framing may be natural — pass it.`,
    tools: [COACHING_TOOL],
    tool_choice: { type: "tool", name: "check_behavior" },
    messages: [{ role: "user", content: `Behavior text: "${text}"` }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "check_behavior"
  );
  if (!toolUse) {
    // If the model doesn't call the tool, pass everything (don't block the member).
    return { observability_ok: true, anonymity_ok: true, absence_ok: true, nudge: "" };
  }
  return toolUse.input as CheckResult;
}

// GET /api/phase3/behaviors?member_id=&team_id=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("member_id");
  const teamId = searchParams.get("team_id");
  if (!memberId || !teamId) return NextResponse.json({ error: "member_id and team_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("member_behaviors")
    .select("*")
    .eq("member_id", memberId)
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ behaviors: data ?? [] });
}

// POST /api/phase3/behaviors
// Body: { member_id, team_id, statement_id, bucket, text, behavior_id? }
//
// The entry is ALWAYS saved (adding a behavior never blocks the member). If a
// coaching check fails, the warning is stored on the row as nudge_text and the
// row is flagged. The board surfaces that warning at the bottom and clears it
// only when the member edits the entry into something that passes. Editing an
// existing entry (behavior_id present) re-runs the checks and updates/clears
// nudge_text accordingly.
// Returns: { saved: true, behavior: row }  (row.nudge_text carries any warning)
export async function POST(req: NextRequest) {
  let memberId: string;
  let teamId: string;
  let statementId: number | null;
  let bucket: BehaviorBucket;
  let text: string;
  let behaviorId: string | undefined;

  try {
    const body = await req.json();
    memberId = body.member_id;
    teamId = body.team_id;
    statementId = typeof body.statement_id === "number" ? body.statement_id : null;
    bucket = body.bucket;
    text = body.text?.trim() ?? "";
    behaviorId = body.behavior_id;

    if (!memberId || !teamId || !["never","sometimes","always"].includes(bucket) || !text) {
      return NextResponse.json({ error: "member_id, team_id, bucket, text required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 500 });

  // Run the coaching checks, but never block on them — infra failures pass.
  let checks: CheckResult;
  try {
    checks = await runChecks(text, apiKey);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[phase3/behaviors] coaching check failed:", msg);
    checks = { observability_ok: true, anonymity_ok: true, absence_ok: true, nudge: "" };
  }

  const needsNudge = !checks.observability_ok || !checks.anonymity_ok || !checks.absence_ok;
  const nudgeText = needsNudge && checks.nudge ? checks.nudge : null;
  const flagged = !!nudgeText;
  const now = new Date().toISOString();

  if (behaviorId) {
    const { data, error } = await supabase
      .from("member_behaviors")
      .update({ text, bucket, flagged, nudge_text: nudgeText, updated_at: now })
      .eq("id", behaviorId)
      .eq("member_id", memberId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
    return NextResponse.json({ saved: true, behavior: data });
  }

  const { data, error } = await supabase
    .from("member_behaviors")
    .insert({ member_id: memberId, team_id: teamId, statement_id: statementId, bucket, text, source: "member", flagged, nudge_text: nudgeText })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ saved: true, behavior: data });
}

// DELETE /api/phase3/behaviors?id=&member_id=
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const memberId = searchParams.get("member_id");
  if (!id || !memberId) return NextResponse.json({ error: "id and member_id required" }, { status: 400 });

  const { error } = await supabase
    .from("member_behaviors")
    .delete()
    .eq("id", id)
    .eq("member_id", memberId);

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
