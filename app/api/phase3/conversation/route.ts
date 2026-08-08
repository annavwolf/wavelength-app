import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import {
  buildPhase3SystemPrompt,
  buildPhase3ImpactPrompt,
  ACTION_PHRASES,
  CONCERN_PHRASES,
  buildPhase3Opening,
  PHASE3_IMPACT_OPENING,
} from "@/prompts/phase3_conversation";
import { MODELS } from "@/lib/models";
import type { Json, Phase3ConversationKind } from "@/types/database";

const MODEL = MODELS.interpret; // reuse the sonnet-tier model
const MAX_TOKENS = 1024;

type ChatMessage = { role: "user" | "assistant"; content: string };

// State carried per kind. Story tracks the two-phase story flow; impact just
// tracks completion + the captured impact text.
type ConvState = {
  story_complete: boolean;
  bridge_complete: boolean;
  story_text: string;
  impact_complete: boolean;
  impact_text: string;
};

function emptyState(): ConvState {
  return {
    story_complete: false,
    bridge_complete: false,
    story_text: "",
    impact_complete: false,
    impact_text: "",
  };
}

const STORY_TOOL: Anthropic.Tool = {
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

const IMPACT_TOOL: Anthropic.Tool = {
  name: "record_impact",
  description: "Record what you say this turn, the captured impact text, and whether the exchange is complete. Call every turn.",
  input_schema: {
    type: "object",
    properties: {
      say: { type: "string", description: "Exactly what you say to the member this turn." },
      impact_text: { type: "string", description: "The member's answer about the impact on the quality of the team's work, captured concisely." },
      complete: { type: "boolean", description: "True once you have accepted their answer (after at most one follow-up)." },
    },
    required: ["say", "impact_text", "complete"],
  },
};

// GET /api/phase3/conversation?member_id=&team_id=&kind=story|impact
// Returns the durable transcript so members resume where they left off.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("member_id");
  const teamId = searchParams.get("team_id");
  const kind = (searchParams.get("kind") ?? "story") as Phase3ConversationKind;
  if (!memberId || !teamId) {
    return NextResponse.json({ error: "member_id and team_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("phase3_conversation_messages")
    .select("messages, state")
    .eq("member_id", memberId)
    .eq("team_id", teamId)
    .eq("kind", kind)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({
    messages: (data?.messages as ChatMessage[] | null) ?? [],
    state: (data?.state as ConvState | null) ?? null,
  });
}

async function persistTranscript(
  memberId: string,
  teamId: string,
  kind: Phase3ConversationKind,
  messages: ChatMessage[],
  state: ConvState
) {
  const { error } = await supabase.from("phase3_conversation_messages").upsert(
    {
      member_id: memberId,
      team_id: teamId,
      kind,
      messages: messages as unknown as Json,
      state: state as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id,team_id,kind" }
  );
  if (error) {
    console.error("[phase3/conversation] transcript persist failed:", error.code, error.message);
  }
}

export async function POST(req: NextRequest) {
  let memberId: string;
  let teamId: string;
  let statementId: number;
  let memberName: string;
  let messages: ChatMessage[];
  let state: ConvState;
  let kind: Phase3ConversationKind;

  try {
    const body = await req.json();
    memberId = body.member_id;
    teamId = body.team_id;
    statementId = body.statement_id;
    memberName = typeof body.member_name === "string" && body.member_name ? body.member_name : "there";
    messages = Array.isArray(body.messages) ? body.messages : [];
    kind = body.kind === "impact" ? "impact" : "story";
    state = body.state?.story_complete !== undefined ? { ...emptyState(), ...body.state } : emptyState();
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

  // First turn: skip the AI call and return the locked opening verbatim.
  if (messages.length === 0) {
    const opening =
      kind === "impact"
        ? PHASE3_IMPACT_OPENING
        : buildPhase3Opening(CONCERN_PHRASES[statementId] ?? "the team isn't always a safe place to work well together");
    const openMessages: ChatMessage[] = [{ role: "assistant", content: opening }];
    const openState = emptyState();
    await persistTranscript(memberId, teamId, kind, openMessages, openState);
    return NextResponse.json({
      say: opening,
      state: openState,
      story_complete: false,
      bridge_complete: false,
      impact_complete: false,
    });
  }

  const system =
    kind === "impact"
      ? buildPhase3ImpactPrompt()
      : buildPhase3SystemPrompt({
          statement_text: statement.statement_text,
          action_phrase: ACTION_PHRASES[statementId] ?? "work well and safely together",
          concern_phrase: CONCERN_PHRASES[statementId] ?? "the team isn't always a safe place to work well together",
          member_name: memberName,
        });

  const convo: ChatMessage[] = [
    { role: "user", content: "Begin or continue this conversation based on the transcript. Call the tool." },
    ...messages,
  ];

  const anthropic = new Anthropic({ apiKey });
  const tool = kind === "impact" ? IMPACT_TOOL : STORY_TOOL;

  let toolInput: Record<string, unknown>;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: convo,
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === tool.name
    );
    if (!toolUse) return NextResponse.json({ error: "ai_no_tool_use" }, { status: 502 });
    toolInput = toolUse.input as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "ai_call_failed", detail: msg }, { status: 502 });
  }

  const say = (typeof toolInput.say === "string" ? toolInput.say.trim() : "") || "Thank you.";
  const nextMessages: ChatMessage[] = [...messages, { role: "assistant", content: say }];

  if (kind === "impact") {
    const impactText = typeof toolInput.impact_text === "string" ? toolInput.impact_text.trim() : "";
    const complete = !!toolInput.complete;
    const nextState: ConvState = {
      ...state,
      impact_complete: state.impact_complete || complete,
      impact_text: impactText || state.impact_text,
    };
    await persistTranscript(memberId, teamId, kind, nextMessages, nextState);

    // On completion, save the captured impact into the context row.
    if (nextState.impact_complete && nextState.impact_text) {
      const { error: ctxErr } = await supabase.from("phase3_context_responses").upsert(
        { member_id: memberId, team_id: teamId, impact_text: nextState.impact_text, updated_at: new Date().toISOString() },
        { onConflict: "member_id,team_id" }
      );
      if (ctxErr) console.error("[phase3/conversation] impact save failed:", ctxErr.code, ctxErr.message);
    }

    return NextResponse.json({ say, state: nextState, impact_complete: nextState.impact_complete });
  }

  // Story kind.
  const nextState: ConvState = {
    ...state,
    story_complete: state.story_complete || !!toolInput.story_complete,
    bridge_complete: state.bridge_complete || !!toolInput.bridge_complete,
    story_text: (typeof toolInput.story_text === "string" ? toolInput.story_text.trim() : "") || state.story_text,
  };
  await persistTranscript(memberId, teamId, kind, nextMessages, nextState);

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
    say,
    state: nextState,
    story_complete: nextState.story_complete,
    bridge_complete: nextState.bridge_complete,
  });
}
