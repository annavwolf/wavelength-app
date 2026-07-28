// Phase 2 clustering (Analytics Spec §2.4). Deterministic: embed each coded
// label, group by a fixed cosine-similarity threshold (union-find → same data,
// same clusters), count by DISTINCT-MEMBER convergence (D-040), and PRESERVE the
// exploded source labels under each cluster (the workshop drags those specific
// behaviours, never the abstract cluster name). An LLM names each cluster
// (naming only — never affects counts). A ≥2-member floor marks what may be
// surfaced as a team pattern (D-031).

import Anthropic from "@anthropic-ai/sdk";
import { embedTexts, cosineSim } from "@/lib/embeddings";
import { MODELS } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import type { InterviewLabel } from "@/types/database";

// Cosine-similarity threshold for grouping (env-overridable). Tuned for
// voyage-3.5: on measured behaviour labels, same-meaning pairs sit ~0.56–0.64
// and distinct behaviours ~0.31–0.43, so 0.55 (with single-linkage) groups
// synonyms cleanly without cross-contamination. Re-tune on real data if needed.
const DEFAULT_THRESHOLD = Number(process.env.OTIS_CLUSTER_THRESHOLD ?? 0.55);

// The five clustering streams. situation splits into context/objective by
// sub_type; the other three primary_codes are their own stream.
export type StreamKey = "context" | "objective" | "out_behavior" | "outcome" | "in_behavior";
export const STREAM_KEYS: StreamKey[] = [
  "context",
  "objective",
  "out_behavior",
  "outcome",
  "in_behavior",
];

export type SourceLabel = {
  secondary_label: string;
  member_id: string;
  statement_id: number;
  multi_member_flag: boolean;
  sensitive_specific: boolean;
};

export type Cluster = {
  name: string;
  workshop_form: string; // transferable behaviour phrase for the workshop circles
  member_count: number; // distinct members (the convergence count)
  label_count: number; // raw label count
  statement_ids: number[]; // distinct PS items contributing
  surfaced: boolean; // member_count >= 2 (safe to surface as a team pattern)
  all_sensitive: boolean; // every source label is sensitive_specific — do not surface to workshop
  source_labels: SourceLabel[]; // exploded, preserved (workshop input + expander)
};

export type ClusterResult = Record<StreamKey, Cluster[]>;

function streamOf(label: InterviewLabel): StreamKey | null {
  if (label.primary_code === "situation") {
    if (label.sub_type === "context") return "context";
    if (label.sub_type === "objective") return "objective";
    return null; // situation label without a sub_type — skip defensively
  }
  return label.primary_code as StreamKey;
}

// Union-find over labels: edge between i,j when cosine(vec_i, vec_j) >= threshold.
// Order-independent (unlike greedy assignment), so clusters are deterministic.
function clusterIndices(vectors: number[][], threshold: number): number[][] {
  const n = vectors.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosineSim(vectors[i], vectors[j]) >= threshold) union(i, j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  // Stable order: by first-member index.
  return Array.from(groups.values()).sort((a, b) => a[0] - b[0]);
}

// Build clusters from labels + their precomputed vectors (pure — no embedding).
function buildClusters(
  labels: InterviewLabel[],
  vectors: number[][],
  threshold: number
): Cluster[] {
  if (labels.length === 0) return [];
  const groups = clusterIndices(vectors, threshold);

  return groups.map((idxs) => {
    const source_labels: SourceLabel[] = idxs.map((i) => ({
      secondary_label: labels[i].secondary_label,
      member_id: labels[i].member_id,
      statement_id: labels[i].statement_id,
      multi_member_flag: labels[i].multi_member_flag,
      sensitive_specific: labels[i].sensitive_specific,
    }));
    const memberCount = new Set(source_labels.map((s) => s.member_id)).size;
    const statementIds = Array.from(
      new Set(source_labels.map((s) => s.statement_id))
    ).sort((a, b) => a - b);
    return {
      name: "", // filled by nameClusters
      workshop_form: "", // filled by nameClusters
      member_count: memberCount,
      label_count: source_labels.length,
      statement_ids: statementIds,
      surfaced: memberCount >= 2,
      all_sensitive: source_labels.every((s) => s.sensitive_specific),
      source_labels,
    };
  });
}

const NAME_CLUSTERS_TOOL: Anthropic.Tool = {
  name: "name_clusters",
  description:
    "Give each cluster a short canonical name and a workshop-ready behaviour phrase. Return both arrays in the SAME ORDER as the clusters provided.",
  input_schema: {
    type: "object",
    properties: {
      names: {
        type: "array",
        items: { type: "string" },
        description: "One short canonical name per cluster (2-5 words, consultant dashboard). In order.",
      },
      workshop_forms: {
        type: "array",
        items: { type: "string" },
        description: "One workshop-ready behaviour phrase per cluster (see rules). In order.",
      },
    },
    required: ["names", "workshop_forms"],
  },
};

// Name a stream's clusters with a single LLM call. Naming only — counts and
// membership are untouched. Reuses one canonical name over near-duplicates.
export async function nameClusters(
  anthropic: Anthropic,
  stream: StreamKey,
  clusters: Cluster[]
): Promise<void> {
  if (clusters.length === 0) return;

  const listing = clusters
    .map(
      (c, i) =>
        `Cluster ${i} (${stream}): ${c.source_labels
          .map((s) => `"${s.secondary_label}"`)
          .join(", ")}`
    )
    .join("\n");

  const system = `You name clusters of coded team-behaviour labels for a consultant dashboard. Each cluster is a group of near-synonymous labels members used.

For each cluster produce TWO things:

1. name (for the consultant dashboard): a SHORT, canonical, human-readable label (2-5 words) that captures what the grouped labels share, staying close to the members' language. Do not invent behaviours not present.

2. workshop_form (for the member-facing workshop circles): a short, transferable behaviour phrase a team could realistically adopt or avoid across many future situations not discussed in this data. Five rules:
   - Transferable: not tied to the specific incident. Could this phrase apply to three different situations the team hasn't discussed? If yes, it passes.
   - Positive-form action even for out-behaviour clusters: a NEVER cluster's workshop_form names the concrete action the team commits NOT to do — never an absence. "talking over others in group discussions" (action, NEVER it) not "not interrupting" (absence, forbidden).
   - De-identifiable: strip roles, quotes, cultural specifics. No "the manager", no near-quotes.
   - Close to members' vocabulary: "talking over each other" beats "practising conversational turn-taking".
   - Observable: something someone could see or hear.
   - Absence head verbs are forbidden in workshop_form: "not", "failing to", "holding back", "withholding", "refraining from", "never X-ing", "neglecting to".

Return exactly one name and one workshop_form per cluster, in order. This is naming only — it must not change the grouping.`;

  const response = await anthropic.messages.create({
    model: MODELS.clusterNaming,
    max_tokens: 1536,
    system,
    tools: [NAME_CLUSTERS_TOOL],
    tool_choice: { type: "tool", name: "name_clusters" },
    messages: [{ role: "user", content: `Name these ${clusters.length} clusters:\n\n${listing}` }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "name_clusters"
  );
  const input = toolUse?.input as { names?: string[]; workshop_forms?: string[] } | undefined;
  const names = input?.names ?? [];
  const workshopForms = input?.workshop_forms ?? [];
  clusters.forEach((c, i) => {
    c.name = (names[i] ?? "").trim() || `${stream} group ${i + 1}`;
    c.workshop_form = (workshopForms[i] ?? "").trim() || c.name;
  });
}

// Full clustering pass for a team: read the coded labels, cluster + name each of
// the five streams. Runs after the coding pass; feeds compute's tier1_json.
export async function clusterTeamLabels(
  teamId: string,
  threshold = DEFAULT_THRESHOLD
): Promise<ClusterResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const { data: labels, error } = await supabase
    .from("interview_labels")
    .select("*")
    .eq("team_id", teamId)
    .order("id", { ascending: true }); // stable input order
  if (error) throw new Error(`interview_labels load failed: ${error.message}`);

  const byStream = new Map<StreamKey, InterviewLabel[]>();
  for (const key of STREAM_KEYS) byStream.set(key, []);
  for (const label of labels ?? []) {
    const s = streamOf(label);
    if (s) byStream.get(s)!.push(label);
  }

  // Embed ALL labels across streams in ONE Voyage call (few calls → fits tight
  // free-tier rate limits; also faster and cheaper than one call per stream).
  const allLabels: InterviewLabel[] = [];
  for (const key of STREAM_KEYS) allLabels.push(...byStream.get(key)!);
  const allVectors = allLabels.length
    ? await embedTexts(allLabels.map((l) => l.secondary_label))
    : [];
  const vecById = new Map<string, number[]>();
  allLabels.forEach((l, i) => vecById.set(l.id, allVectors[i]));

  const anthropic = new Anthropic({ apiKey });
  const result = {} as ClusterResult;
  for (const key of STREAM_KEYS) {
    const labs = byStream.get(key)!;
    const vecs = labs.map((l) => vecById.get(l.id)!);
    const clusters = buildClusters(labs, vecs, threshold);
    await nameClusters(anthropic, key, clusters);
    // Rank by convergence (most members first) for the dashboard.
    clusters.sort((a, b) => b.member_count - a.member_count || b.label_count - a.label_count);
    result[key] = clusters;
  }
  return result;
}
