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
};

export type Cluster = {
  name: string;
  member_count: number; // distinct members (the convergence count)
  label_count: number; // raw label count
  statement_ids: number[]; // distinct PS items contributing
  surfaced: boolean; // member_count >= 2 (safe to surface as a team pattern)
  source_labels: SourceLabel[]; // exploded, preserved (workshop input)
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

// Cluster one stream's labels into Clusters (unnamed — naming is a later step).
export async function clusterStream(
  labels: InterviewLabel[],
  threshold = DEFAULT_THRESHOLD
): Promise<Cluster[]> {
  if (labels.length === 0) return [];
  const vectors = await embedTexts(labels.map((l) => l.secondary_label));
  const groups = clusterIndices(vectors, threshold);

  return groups.map((idxs) => {
    const source_labels: SourceLabel[] = idxs.map((i) => ({
      secondary_label: labels[i].secondary_label,
      member_id: labels[i].member_id,
      statement_id: labels[i].statement_id,
      multi_member_flag: labels[i].multi_member_flag,
    }));
    const memberCount = new Set(source_labels.map((s) => s.member_id)).size;
    const statementIds = Array.from(
      new Set(source_labels.map((s) => s.statement_id))
    ).sort((a, b) => a - b);
    return {
      name: "", // filled by nameClusters
      member_count: memberCount,
      label_count: source_labels.length,
      statement_ids: statementIds,
      surfaced: memberCount >= 2,
      source_labels,
    };
  });
}

const NAME_CLUSTERS_TOOL: Anthropic.Tool = {
  name: "name_clusters",
  description:
    "Give each cluster a short canonical name. Return names in the SAME ORDER as the clusters provided.",
  input_schema: {
    type: "object",
    properties: {
      names: {
        type: "array",
        items: { type: "string" },
        description: "One short name per cluster, in order.",
      },
    },
    required: ["names"],
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

  const system = `You name clusters of coded team-behaviour labels for a consultant dashboard. Each cluster is a group of near-synonymous labels members used. Give each a SHORT, canonical, human-readable name (2-5 words) that captures what the grouped labels share, staying close to the members' language. Do not invent behaviours not present. Return exactly one name per cluster, in order. This is naming only — it must not change the grouping.`;

  const response = await anthropic.messages.create({
    model: MODELS.clusterNaming,
    max_tokens: 1024,
    system,
    tools: [NAME_CLUSTERS_TOOL],
    tool_choice: { type: "tool", name: "name_clusters" },
    messages: [{ role: "user", content: `Name these ${clusters.length} clusters:\n\n${listing}` }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "name_clusters"
  );
  const names = (toolUse?.input as { names?: string[] } | undefined)?.names ?? [];
  clusters.forEach((c, i) => {
    c.name = (names[i] ?? "").trim() || `${stream} group ${i + 1}`;
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

  const anthropic = new Anthropic({ apiKey });
  const result = {} as ClusterResult;
  for (const key of STREAM_KEYS) {
    const clusters = await clusterStream(byStream.get(key)!, threshold);
    await nameClusters(anthropic, key, clusters);
    // Rank by convergence (most members first) for the dashboard.
    clusters.sort((a, b) => b.member_count - a.member_count || b.label_count - a.label_count);
    result[key] = clusters;
  }
  return result;
}
