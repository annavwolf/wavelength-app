// Phase 4 §2 — two-pass example-bucket classification.
//
// Replaces the old centroid/embedding approach in lib/behaviourGrouping.ts.
// Each member-submitted behaviour is classified into one of Anna's pre-authored
// ALWAYS or NEVER example behaviours (from lib/itemExamples.ts §4.8), or left
// unbucketed. Two independent LLM passes (§2.2 / §2.3 of the spec):
//
//   Pass 1 — classify each submission independently (no inter-submission context).
//   Pass 2 — a single skeptical reviewer sees all Pass 1 results and may confirm,
//             move, demote, or rescue each one.
//
// The final agreement text uses the bucket labels (Anna's wording), not a member's
// phrasing, eliminating the "one member's words win" failure mode.

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { ITEM_EXAMPLES } from "@/lib/itemExamples";
import { MODELS } from "@/lib/models";
import type { BehaviorBucket, MemberBehavior, Phase4BehaviourGroup } from "@/types/database";

// ── Bucket registry (built once from ITEM_EXAMPLES) ──────────────────────────

type Bucket = { id: string; label: string; valence: "always" | "never" };

function buildBuckets(): { always: Bucket[]; never: Bucket[] } {
  const always: Bucket[] = [];
  const never: Bucket[] = [];
  for (const [sid, ex] of Object.entries(ITEM_EXAMPLES)) {
    ex.always.forEach((label, i) => always.push({ id: `always_${sid}_${i}`, label, valence: "always" }));
    ex.never.forEach((label, i) => never.push({ id: `never_${sid}_${i}`, label, valence: "never" }));
  }
  return { always, never };
}

const BUCKETS = buildBuckets();
const ALL_BUCKETS = [...BUCKETS.always, ...BUCKETS.never];

// ── Exported types ────────────────────────────────────────────────────────────

export type SubmissionClassification = {
  submission_id: string;
  text: string;
  valence: BehaviorBucket;
  member_id: string;
  pass1_bucket_id: string | null;
  pass1_confidence: "high" | "medium" | "low";
  pass1_reason: string;
  final_bucket_id: string | null;
  pass2_action: "confirmed" | "moved" | "demoted" | "rescued";
  pass2_reason: string;
};

export type ClassificationResult = {
  groups: Phase4BehaviourGroup[];
  unbucketed: SubmissionClassification[];
  trajectories: SubmissionClassification[];
  memberCount: number;
};

// ── Pass 1 — independent per-submission classification ────────────────────────

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_behavior",
  description: "Classify a submitted team behaviour into one of the provided example buckets, or leave it unbucketed.",
  input_schema: {
    type: "object",
    properties: {
      proposed_bucket_id: {
        type: ["string", "null"],
        description: "The id of the best-matching bucket, or null if none clearly fits.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "How confident you are in this assignment.",
      },
      reason: {
        type: "string",
        description: "One sentence explaining the assignment or why it is unbucketed.",
      },
    },
    required: ["proposed_bucket_id", "confidence", "reason"],
  },
};

function bucketListForPrompt(buckets: Bucket[]): string {
  return buckets.map((b) => `  id: ${b.id}\n  label: "${b.label}"`).join("\n\n");
}

async function classifyOne(
  anthropic: Anthropic,
  behavior: MemberBehavior,
  buckets: Bucket[]
): Promise<{ proposed_bucket_id: string | null; confidence: "high" | "medium" | "low"; reason: string }> {
  const system = `You classify a team member's submitted behaviour into one of the provided example buckets.

RULES:
- Pick the bucket whose label best describes what the submitted behaviour is asking the team to do.
- If none of the buckets clearly fits, return null for proposed_bucket_id. Do NOT stretch a bucket to fit. Do NOT force near-matches. An unbucketed submission is more useful than a mislabelled one.
- Cross-item bucketing is intentional — a behaviour submitted for any topic may match any bucket.
- Return your classification using the classify_behavior tool.`;

  const user = `SUBMITTED BEHAVIOUR (valence: ${behavior.bucket}):
"${behavior.text}"

AVAILABLE BUCKETS:
${bucketListForPrompt(buckets)}`;

  try {
    const response = await anthropic.messages.create({
      model: MODELS.clusterNaming,
      max_tokens: 256,
      system,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "tool", name: "classify_behavior" },
      messages: [{ role: "user", content: user }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "classify_behavior"
    );
    const input = toolUse?.input as { proposed_bucket_id?: string | null; confidence?: string; reason?: string } | undefined;
    const bucket_id = input?.proposed_bucket_id ?? null;
    // Validate the returned id actually exists in the bucket list.
    const valid = bucket_id ? buckets.some((b) => b.id === bucket_id) : true;
    return {
      proposed_bucket_id: valid ? bucket_id : null,
      confidence: (input?.confidence as "high" | "medium" | "low") ?? "low",
      reason: input?.reason ?? "",
    };
  } catch (err) {
    console.error("[behaviourClassification] Pass 1 error:", err instanceof Error ? err.message : err);
    return { proposed_bucket_id: null, confidence: "low", reason: "classification error" };
  }
}

// ── Pass 2 — single skeptical reviewer sees all Pass 1 results ────────────────

const REVIEW_TOOL: Anthropic.Tool = {
  name: "review_classifications",
  description: "Review all Pass 1 classifications and confirm, move, demote, or rescue each one.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            submission_id: { type: "string" },
            final_bucket_id: { type: ["string", "null"] },
            action: { type: "string", enum: ["confirmed", "moved", "demoted", "rescued"] },
            reason: { type: "string" },
          },
          required: ["submission_id", "final_bucket_id", "action", "reason"],
        },
      },
    },
    required: ["results"],
  },
};

async function reviewAll(
  anthropic: Anthropic,
  pass1Results: SubmissionClassification[],
  allBuckets: Bucket[]
): Promise<Map<string, { final_bucket_id: string | null; action: SubmissionClassification["pass2_action"]; reason: string }>> {
  const fallback = new Map(
    pass1Results.map((r) => [r.submission_id, {
      final_bucket_id: r.pass1_bucket_id,
      action: "confirmed" as const,
      reason: "Pass 2 not run",
    }])
  );

  if (pass1Results.length === 0) return fallback;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const system = `You are the second-pass reviewer for a team behaviour classification system. Your job is skeptical review — not rubber-stamping Pass 1.

For each submission you may:
- CONFIRM: Pass 1's assignment is the best fit. Use this freely for high-confidence Pass 1 calls.
- MOVE: A different bucket fits better. Give a genuinely stronger reason than Pass 1's.
- DEMOTE: The assigned bucket doesn't actually fit well. Move it to unbucketed (final_bucket_id: null).
- RESCUE: Pass 1 left it unbucketed, but you see a reasonable fit.

Do NOT override high-confidence Pass 1 assignments without a clearly better reason.
Do NOT invent new buckets. Do NOT leave any submission without a response.
Return exactly one result per submission_id using the review_classifications tool.`;

  const bucketRef = allBuckets.map((b) => `${b.id}: "${b.label}" [${b.valence}]`).join("\n");
  const submissionsText = pass1Results.map((r) => {
    const bucketLabel = r.pass1_bucket_id ? allBuckets.find((b) => b.id === r.pass1_bucket_id)?.label : null;
    return `submission_id: ${r.submission_id}
text: "${r.text}" (valence: ${r.valence})
pass1: ${r.pass1_bucket_id ? `→ "${bucketLabel}" (${r.pass1_bucket_id})` : "unbucketed"} [${r.pass1_confidence}]
reason: ${r.pass1_reason}`;
  }).join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.clusterNaming,
      max_tokens: 2048,
      system,
      tools: [REVIEW_TOOL],
      tool_choice: { type: "tool", name: "review_classifications" },
      messages: [{ role: "user", content: `AVAILABLE BUCKETS:\n${bucketRef}\n\nSUBMISSIONS TO REVIEW:\n${submissionsText}` }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "review_classifications"
    );
    const results = (toolUse?.input as { results?: unknown[] } | undefined)?.results ?? [];
    const out = new Map<string, { final_bucket_id: string | null; action: SubmissionClassification["pass2_action"]; reason: string }>();
    for (const r of results) {
      const item = r as { submission_id?: string; final_bucket_id?: string | null; action?: string; reason?: string };
      if (!item.submission_id) continue;
      const bid = item.final_bucket_id ?? null;
      const valid = bid ? allBuckets.some((b) => b.id === bid) : true;
      out.set(item.submission_id, {
        final_bucket_id: valid ? bid : null,
        action: (["confirmed", "moved", "demoted", "rescued"].includes(item.action ?? "")
          ? item.action as SubmissionClassification["pass2_action"]
          : "confirmed"),
        reason: item.reason ?? "",
      });
    }
    // Fill any missing with fallback (Pass 1 result confirmed).
    for (const r of pass1Results) {
      if (!out.has(r.submission_id)) {
        out.set(r.submission_id, { final_bucket_id: r.pass1_bucket_id, action: "confirmed", reason: "not reviewed" });
      }
    }
    return out;
  } catch (err) {
    console.error("[behaviourClassification] Pass 2 error:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function classifyTeamBehaviours(teamId: string): Promise<ClassificationResult> {
  const { data, error } = await supabase
    .from("member_behaviors")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`member_behaviors load failed: ${error.message}`);

  const behaviours = (data ?? []) as MemberBehavior[];
  const memberCount = new Set(behaviours.map((b) => b.member_id)).size;
  if (behaviours.length === 0) return { groups: [], unbucketed: [], trajectories: [], memberCount };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey });

  // Pass 1 — independent per-submission (parallel).
  const pass1Raw = await Promise.all(
    behaviours.map(async (b): Promise<SubmissionClassification> => {
      // SOMETIMES submissions go against the full set; others against their valence.
      const buckets = b.bucket === "sometimes" ? ALL_BUCKETS
        : b.bucket === "always" ? BUCKETS.always
        : BUCKETS.never;
      const p1 = await classifyOne(anthropic, b, buckets);
      return {
        submission_id: b.id,
        text: b.text,
        valence: b.bucket,
        member_id: b.member_id,
        pass1_bucket_id: p1.proposed_bucket_id,
        pass1_confidence: p1.confidence,
        pass1_reason: p1.reason,
        // Placeholders filled after Pass 2.
        final_bucket_id: null,
        pass2_action: "confirmed",
        pass2_reason: "",
      };
    })
  );

  // Pass 2 — one call, all results (§2.3).
  const pass2Map = await reviewAll(anthropic, pass1Raw, ALL_BUCKETS);

  // Merge Pass 2 into final classifications.
  const trajectories: SubmissionClassification[] = pass1Raw.map((r) => {
    const p2 = pass2Map.get(r.submission_id);
    return { ...r, final_bucket_id: p2?.final_bucket_id ?? r.pass1_bucket_id, pass2_action: p2?.action ?? "confirmed", pass2_reason: p2?.reason ?? "" };
  });

  // Separate bucketed from unbucketed.
  const bucketed = trajectories.filter((r) => r.final_bucket_id !== null);
  const unbucketed = trajectories.filter((r) => r.final_bucket_id === null);

  // Aggregate: per bucket, collect distinct members + contributing submissions.
  // §4.6.2: when pass2 moves a submission to a different bucket, it appears in
  // BOTH the pass1 bucket and the pass2 bucket (intentional double-counting).
  // The per-member-per-bucket cap is enforced by the members Set — one member
  // can never add more than 1 to any single bucket's support count.
  const bucketMap = new Map<string, { members: Set<string>; valences: Set<BehaviorBucket>; submissions: SubmissionClassification[] }>();

  function addToBucket(bid: string, r: SubmissionClassification) {
    if (!bucketMap.has(bid)) bucketMap.set(bid, { members: new Set(), valences: new Set(), submissions: [] });
    const entry = bucketMap.get(bid)!;
    entry.members.add(r.member_id);
    entry.valences.add(r.valence);
    entry.submissions.push({ ...r, final_bucket_id: bid });
  }

  for (const r of bucketed) {
    addToBucket(r.final_bucket_id!, r);
    // Double-bucket: also record in pass1's bucket when pass2 disagreed.
    if (
      r.pass2_action === "moved" &&
      r.pass1_bucket_id !== null &&
      r.pass1_bucket_id !== r.final_bucket_id
    ) {
      addToBucket(r.pass1_bucket_id, r);
    }
  }

  // Build Phase4BehaviourGroup objects.
  const groups: (Phase4BehaviourGroup & { contributing_submissions?: SubmissionClassification[] })[] = [];
  for (const [bid, { members, valences, submissions }] of Array.from(bucketMap.entries())) {
    const bucket = ALL_BUCKETS.find((b) => b.id === bid);
    if (!bucket) continue;

    // Dominant bucket: for SOMETIMES submissions that landed in an ALWAYS/NEVER
    // bucket, count toward that valence. For bucket_split, check if distinct
    // member valences include more than one of never/always/sometimes.
    const never_members = submissions.filter((s) => s.valence === "never").length;
    const sometimes_members = submissions.filter((s) => s.valence === "sometimes").length;
    const always_members = submissions.filter((s) => s.valence === "always").length;
    const bucket_split = valences.size > 1 && (valences.has("never") || valences.has("always"));

    groups.push({
      name: bucket.label,
      representative: bucket.label,
      bucket: bucket.valence,
      member_count: members.size,
      never_members,
      sometimes_members,
      always_members,
      bucket_split,
      contributing_submissions: submissions,
    });
  }

  // Sort by convergence (member_count desc), stable by id.
  groups.sort((a, b) => b.member_count - a.member_count || (ALL_BUCKETS.findIndex((x) => x.label === a.representative) - ALL_BUCKETS.findIndex((x) => x.label === b.representative)));

  return { groups, unbucketed, trajectories, memberCount };
}
