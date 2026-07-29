import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { buildPhase3SystemPrompt, ACTION_PHRASES, buildPhase3Opening } from "@/prompts/phase3_conversation";
import { MODELS } from "@/lib/models";

const MODEL = MODELS.interpret; // reuse the sonnet-tier model
const MAX_TOKENS = 1024;

type ChatMessage = { role: "user" | "assistant"; content: string };

type ConvState = {
  story_complete: boolean;
  bridge_complete: boolean;
  story_text: string;
};

function emptyState(): ConvState {
  return { story_complete: false, bridge_complete: false, story_text: "" };
}

const RECORD_TURN_TOOL: Anthropic.Tool = {
  name: "record_turn",
  description: "Record what you say this turn, the accumulated story, and your completion flags. Call every turn.",
  input_schema: {
    type: "object",
    properties: {
      say: { type: "string", description: "Exactly what you say to the member this turn." },
      story_text: { type: "string", description: "Accumulated story text so far (concise, factual). Empty until the member has shared something." },
      story_complete: { type: "boolean", description: "True when you have received a meaningful story (even brief)." },
      bridge_complete: { type: "boolean", description: "True only after you have delivered the full bridge message." },
    },
    required: ["say", "story_text", "story_complete", "bridge_complete"],
  },
};

type RecordTurn = {
  say: string;
  story_text: string;
  story_complete: boolean;
  bridge_complete: boolean;
};

export async function POST(req: NextRequest) {
  let memberId: string;
  let teamId: string;
  let statementId: number;
  let memberName: string;
  let messages: ChatMessage[];
  let state: ConvState;

  try {
    const body = await req.json();
    memberId = body.member_id;
    teamId = body.team_id;
    statementId = body.statement_id;
    memberName = typeof body.member_name === "string" && body.member_name ? body.member_name : "there";
    messages = Array.isArray(body.messages) ? body.messages : [];
    state = body.state?.story_complete !== undefined ? (body.state as ConvState) : emptyState();
    if (!memberId || !teamId || typeof statementId !== "number") {
      return NextResponse.json({ error: "member_id, team_id, and statement_id required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 500 });

  // Canonical statement wording from DB.
  const { data: statement, error: stmtErr } = await supabase
    .from("ps_statements")
    .select("statement_id, statement_text")
    .eq("statement_id", statementId)
    .maybeSingle();

  if (stmtErr) return NextResponse.json({ error: "db_error", detail: stmtErr.message }, { status: 500 });
  if (!statement) return NextResponse.json({ error: "statement_not_found" }, { status: 404 });

  // First turn: skip the AI call and return the locked §4.2 opening verbatim.
  // This guarantees the exact wording regardless of model behaviour.
  if (messages.length === 0) {
    const actionPhrase = ACTION_PHRASES[statementId] ?? "work well and safely together";
    const opening = buildPhase3Opening(actionPhrase);
    return NextResponse.json({
      say: opening,
      state: emptyState(),
      story_complete: false,
      bridge_complete: false,
    });
  }

  const system = buildPhase3SystemPrompt({
    statement_text: statement.statement_text,
    action_phrase: ACTION_PHRASES[statementId] ?? "work well and safely together",
    member_name: memberName,
  });

  // Anthropic requires a leading user turn.
  const convo: ChatMessage[] = [
    {
      role: "user",
      content: "Begin or continue this conversation based on the transcript. Call record_turn.",
    },
    ...messages,
  ];

  const anthropic = new Anthropic({ apiKey });

  let turn: RecordTurn;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: [RECORD_TURN_TOOL],
      tool_choice: { type: "tool", name: "record_turn" },
      messages: convo,
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_turn"
    );
    if (!toolUse) return NextResponse.json({ error: "ai_no_tool_use" }, { status: 502 });
    turn = toolUse.input as RecordTurn;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "ai_call_failed", detail: msg }, { status: 502 });
  }

  // Merge state.
  const nextState: ConvState = {
    story_complete: state.story_complete || turn.story_complete,
    bridge_complete: state.bridge_complete || turn.bridge_complete,
    story_text: turn.story_text.trim() || state.story_text,
  };

  // Auto-save story when complete.
  if (nextState.story_complete && !state.story_complete && nextState.story_text) {
    const { error: storyErr } = await supabase.from("member_stories").upsert(
      {
        member_id: memberId,
        team_id: teamId,
        statement_id: statementId,
        story_text: nextState.story_text,
        story_order: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,team_id,statement_id" }
    );
    if (storyErr) {
      console.error("[phase3/conversation] story save failed:", storyErr.code, storyErr.message, storyErr.details ?? "");
    }
  }

  return NextResponse.json({
    say: turn.say.trim() || "Thank you.",
    state: nextState,
    story_complete: nextState.story_complete,
    bridge_complete: nextState.bridge_complete,
  });
}
