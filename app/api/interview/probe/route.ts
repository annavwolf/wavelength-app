import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import {
  PS_INTERVIEW_SYSTEM_PROMPT,
  FELT_PHRASES,
  DIRECT_QUESTIONS,
  BUCKETS,
  type Bucket,
} from "@/prompts/ps_interview";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

// §4.2 hard cap — never spend more than this many asks on one bucket.
const MAX_TURNS_PER_BUCKET = 4;

type ChatMessage = { role: "user" | "assistant"; content: string };

// Server-authoritative state, round-tripped with the client each turn. Turn
// counts and accumulated distilled text live here (not trusted to the model).
type ProbeState = {
  turns: Record<Bucket, number>;
  buckets: Record<Bucket, string>;
};

function emptyState(): ProbeState {
  return {
    turns: { situation: 0, out_behavior: 0, outcome: 0, in_behavior: 0 },
    buckets: { situation: "", out_behavior: "", outcome: "", in_behavior: "" },
  };
}

// The structured turn the model must produce (forced tool_choice).
const RECORD_TURN_TOOL: Anthropic.Tool = {
  name: "record_turn",
  description:
    "Record what you say this turn plus your current distilled text and completeness judgment for each of the four buckets. Call this every turn.",
  input_schema: {
    type: "object",
    properties: {
      say: { type: "string", description: "Exactly what you say to the member this turn." },
      situation_text: { type: "string" },
      out_behavior_text: { type: "string" },
      outcome_text: { type: "string" },
      in_behavior_text: { type: "string" },
      situation_has_context: { type: "boolean" },
      situation_has_objective: { type: "boolean" },
      out_behavior_has_observable: { type: "boolean" },
      outcome_has_concrete_effect: { type: "boolean" },
      in_behavior_has_specific_alternative: { type: "boolean" },
      proposed_active_bucket: {
        type: "string",
        enum: ["situation", "out_behavior", "outcome", "in_behavior", "done"],
      },
      proposed_item_complete: { type: "boolean" },
    },
    required: ["say", "proposed_active_bucket", "proposed_item_complete"],
  },
};

type RecordTurn = {
  say: string;
  situation_text?: string;
  out_behavior_text?: string;
  outcome_text?: string;
  in_behavior_text?: string;
  situation_has_context?: boolean;
  situation_has_objective?: boolean;
  out_behavior_has_observable?: boolean;
  outcome_has_concrete_effect?: boolean;
  in_behavior_has_specific_alternative?: boolean;
  proposed_active_bucket: Bucket | "done";
  proposed_item_complete: boolean;
};

// Is a bucket genuinely satisfied per the §6 checklist? Requires the model's
// criteria flags AND non-empty distilled text.
function bucketSatisfied(bucket: Bucket, t: RecordTurn, text: string): boolean {
  if (!text.trim()) return false;
  switch (bucket) {
    case "situation":
      return !!t.situation_has_context && !!t.situation_has_objective;
    case "out_behavior":
      return !!t.out_behavior_has_observable;
    case "outcome":
      return !!t.outcome_has_concrete_effect;
    case "in_behavior":
      return !!t.in_behavior_has_specific_alternative;
  }
}

export async function POST(req: NextRequest) {
  let statementId: number;
  let memberId: string;
  let isAllPositive: boolean;
  let messages: ChatMessage[];
  let state: ProbeState;
  try {
    const body = await req.json();
    statementId = body.statement_id;
    memberId = body.member_id;
    isAllPositive = !!body.is_all_positive_branch;
    messages = Array.isArray(body.messages) ? body.messages : [];
    state = body.state && body.state.turns ? (body.state as ProbeState) : emptyState();
    if (typeof statementId !== "number" || !memberId) {
      return NextResponse.json({ error: "statement_id and member_id required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    return await runProbe(statementId, memberId, isAllPositive, messages, state);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[interview/probe] unexpected error:", err);
    return NextResponse.json({ error: "unexpected_error", detail: msg }, { status: 500 });
  }
}

async function runProbe(
  statementId: number,
  memberId: string,
  isAllPositive: boolean,
  messages: ChatMessage[],
  state: ProbeState
): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  // Canonical item wording comes from the DB, not the client.
  const { data: statement, error: stmtError } = await supabase
    .from("ps_statements")
    .select("*")
    .eq("statement_id", statementId)
    .maybeSingle();

  if (stmtError) {
    return NextResponse.json({ error: "db_error", detail: stmtError.message }, { status: 500 });
  }
  if (!statement) {
    return NextResponse.json({ error: "statement_not_found" }, { status: 404 });
  }

  const feltPhrase = FELT_PHRASES[statementId] ?? "";

  const itemContext = `# THIS ITEM
Statement being discussed: "${statement.statement_text}"
Entry-line felt-phrase (use in your opening line): "${feltPhrase}"
${
  isAllPositive
    ? `This is the ALL-POSITIVE branch (§5): the member scored their team well everywhere and CHOSE this item to reflect on. Do NOT imply anything went wrong. Frame it as a moment that went fine but could have gone even better. For the out-behavior turn, ask "What did people do or say in that moment?" (do NOT say "led you to disagree").`
    : `The member scored this item Neutral or below. Probe the real situation behind that score.`
}`;

  const system = `${PS_INTERVIEW_SYSTEM_PROMPT}\n\n${itemContext}`;

  // Anthropic requires a leading user turn. The stored transcript is
  // assistant-first (Otis opens), so we prepend a synthetic kickoff user turn;
  // the result alternates correctly.
  const convo: ChatMessage[] = [
    {
      role: "user",
      content:
        "Begin or continue this interview based on the transcript so far. Ask one short question this turn and call record_turn.",
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
    if (!toolUse) {
      return NextResponse.json({ error: "ai_no_tool_use" }, { status: 502 });
    }
    turn = toolUse.input as RecordTurn;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[interview/probe] Anthropic call failed:", err);
    return NextResponse.json({ error: "ai_call_failed", detail: msg }, { status: 502 });
  }

  // ── Merge distilled text: take the model's latest non-empty text per bucket ──
  const modelText: Record<Bucket, string | undefined> = {
    situation: turn.situation_text,
    out_behavior: turn.out_behavior_text,
    outcome: turn.outcome_text,
    in_behavior: turn.in_behavior_text,
  };
  for (const b of BUCKETS) {
    const t = (modelText[b] ?? "").trim();
    if (t) state.buckets[b] = t;
  }

  // ── Authoritative next-bucket decision + safety net ─────────────────────────
  // Walk buckets in order; the first that is neither satisfied nor capped is the
  // one we ask about next. If none remain, the item is complete.
  let activeBucket: Bucket | null = null;
  for (const b of BUCKETS) {
    const satisfied = bucketSatisfied(b, turn, state.buckets[b]);
    if (!satisfied && state.turns[b] < MAX_TURNS_PER_BUCKET) {
      activeBucket = b;
      break;
    }
  }

  let say: string;
  if (activeBucket === null) {
    say = turn.say?.trim() || "Thank you for sharing that with me.";
  } else {
    // Count this ask against the active bucket's cap.
    state.turns[activeBucket] += 1;
    // Use the model's line only when it's actually working the same bucket we
    // need; otherwise fall back to the canned direct question so we never skip
    // a bucket the member hasn't really answered.
    say =
      turn.proposed_active_bucket === activeBucket && turn.say?.trim()
        ? turn.say.trim()
        : DIRECT_QUESTIONS[activeBucket];
  }

  return NextResponse.json({
    say,
    state,
    item_complete: activeBucket === null,
    active_bucket: activeBucket,
    buckets: state.buckets,
  });
}
