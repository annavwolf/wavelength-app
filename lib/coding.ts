// Phase 2 coding pass — turns the four free-text buckets in
// ps_interview_responses into coded labels in interview_labels.
// Canonical source: Otis_Phase2_Coding_Spec_v1.md. Extraction only (no
// interpretation); output is the input to clustering (Analytics Spec §2.4).

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/models";
import { CODING_SYSTEM_PROMPT } from "@/prompts/part2_coding";
import type {
  InterviewLabelInsert,
  PrimaryCode,
  LabelSubType,
  SourceField,
  PsInterviewResponse,
  PsStatement,
} from "@/types/database";

const MAX_TOKENS = 2048;

const PRIMARY_CODES: PrimaryCode[] = ["situation", "out_behavior", "outcome", "in_behavior"];
const SUB_TYPES: LabelSubType[] = ["context", "objective"];
const SOURCE_FIELDS: SourceField[] = [
  "situation_text",
  "out_behavior_text",
  "outcome_text",
  "in_behavior_text",
];

// Forced-tool output shape (matches the record_labels schema below).
type RawLabel = {
  primary_code?: string;
  secondary_label?: string;
  sub_type?: string | null;
  multi_member_flag?: boolean;
  source_field?: string | null;
};

const RECORD_LABELS_TOOL: Anthropic.Tool = {
  name: "record_labels",
  description:
    "Record every coded label extracted from this member's interview answers for one PS item. Call exactly once with all labels.",
  input_schema: {
    type: "object",
    properties: {
      labels: {
        type: "array",
        items: {
          type: "object",
          properties: {
            primary_code: {
              type: "string",
              enum: ["situation", "out_behavior", "outcome", "in_behavior"],
            },
            secondary_label: {
              type: "string",
              description: "The coded text, in the member's own words (gerund / context / objective / outcome).",
            },
            sub_type: {
              type: "string",
              enum: ["context", "objective"],
              description: "situation labels only; omit for other codes.",
            },
            multi_member_flag: {
              type: "boolean",
              description: "situation labels only; true if the situation may NOT involve multiple team members.",
            },
            source_field: {
              type: "string",
              enum: ["situation_text", "out_behavior_text", "outcome_text", "in_behavior_text"],
              description: "Which free-text field this label came from.",
            },
          },
          required: ["primary_code", "secondary_label", "source_field"],
        },
      },
    },
    required: ["labels"],
  },
};

function buildUserMessage(row: PsInterviewResponse, statement: PsStatement): string {
  const field = (label: string, value: string | null) =>
    value && value.trim() ? `${label}:\n${value.trim()}` : `${label}:\n(empty)`;
  return `PS item being discussed: "${statement.statement_text}"

Code the following four fields into labels. Go line by line; empty fields yield no labels.

${field("situation_text", row.situation_text)}

${field("out_behavior_text", row.out_behavior_text)}

${field("outcome_text", row.outcome_text)}

${field("in_behavior_text", row.in_behavior_text)}`;
}

// Validate + coerce one raw label from the model into an insert row, or null if
// it fails the enum/shape checks (defensive — we never trust the model blindly).
function toInsert(
  raw: RawLabel,
  row: PsInterviewResponse
): InterviewLabelInsert | null {
  const primary = raw.primary_code as PrimaryCode;
  const secondary = (raw.secondary_label ?? "").trim();
  if (!PRIMARY_CODES.includes(primary) || !secondary) return null;

  const subType =
    primary === "situation" && raw.sub_type && SUB_TYPES.includes(raw.sub_type as LabelSubType)
      ? (raw.sub_type as LabelSubType)
      : null;
  const sourceField = SOURCE_FIELDS.includes(raw.source_field as SourceField)
    ? (raw.source_field as SourceField)
    : null;

  return {
    team_id: row.team_id,
    member_id: row.member_id,
    statement_id: row.statement_id,
    primary_code: primary,
    secondary_label: secondary,
    sub_type: subType,
    // multi_member_flag is meaningful for situation labels only.
    multi_member_flag: primary === "situation" ? !!raw.multi_member_flag : false,
    source_field: sourceField,
  };
}

// Code a single member×item interview row → its coded labels.
export async function codeInterviewRow(
  anthropic: Anthropic,
  row: PsInterviewResponse,
  statement: PsStatement
): Promise<InterviewLabelInsert[]> {
  const response = await anthropic.messages.create({
    model: MODELS.coding,
    max_tokens: MAX_TOKENS,
    system: CODING_SYSTEM_PROMPT,
    tools: [RECORD_LABELS_TOOL],
    tool_choice: { type: "tool", name: "record_labels" },
    messages: [{ role: "user", content: buildUserMessage(row, statement) }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_labels"
  );
  if (!toolUse) return [];

  const rawLabels = (toolUse.input as { labels?: RawLabel[] }).labels ?? [];
  return rawLabels
    .map((r) => toInsert(r, row))
    .filter((x): x is InterviewLabelInsert => x !== null);
}

export type CodingResult = {
  rows_processed: number;
  labels_created: number;
};

// Full coding pass for a team: (re)derive all labels from stored interview text.
// Deletes the team's existing labels first (coding is a pure re-derivation), then
// codes every interview row and inserts the labels. Idempotent by design.
export async function codeTeamInterviews(teamId: string): Promise<CodingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const [{ data: rows, error: rowsError }, { data: statements, error: stmtError }] =
    await Promise.all([
      supabase.from("ps_interview_responses").select("*").eq("team_id", teamId),
      supabase.from("ps_statements").select("*"),
    ]);
  if (rowsError) throw new Error(`interview rows load failed: ${rowsError.message}`);
  if (stmtError) throw new Error(`ps_statements load failed: ${stmtError.message}`);

  const statementById = new Map((statements ?? []).map((s) => [s.statement_id, s]));
  const anthropic = new Anthropic({ apiKey });

  // Wipe this team's prior labels before re-deriving.
  const { error: delError } = await supabase
    .from("interview_labels")
    .delete()
    .eq("team_id", teamId);
  if (delError) throw new Error(`clearing old labels failed: ${delError.message}`);

  let labelsCreated = 0;
  let rowsProcessed = 0;

  // Sequential: team sizes are small (≤12 members, 1–2 items each), so this stays
  // well under rate limits and keeps ordering deterministic.
  for (const row of rows ?? []) {
    const statement = statementById.get(row.statement_id);
    if (!statement) continue;
    const inserts = await codeInterviewRow(anthropic, row, statement);
    rowsProcessed += 1;
    if (inserts.length === 0) continue;
    const { error: insError } = await supabase.from("interview_labels").insert(inserts);
    if (insError) throw new Error(`inserting labels failed: ${insError.message}`);
    labelsCreated += inserts.length;
  }

  return { rows_processed: rowsProcessed, labels_created: labelsCreated };
}
