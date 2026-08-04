// Phase 4 self-serve §2 — behaviour grouping (single-stream).
//
// A scaled-down, single-stream version of the retired 5-stream pipeline. It
// reuses the SAME deterministic machinery: embed each member-submitted
// behaviour, group by a fixed cosine threshold with union-find (lib/clustering
// clusterIndices), count DISTINCT members per group (D-040 convergence). No
// coding pass — members already typed clean, coached behaviours in Phase 3.
//
// LOCKED rules (spec §2):
//   • The maths forms groups; the LLM only NAMES them. Counts are reproducible.
//   • Representative wording = the phrasing closest to the group centroid (the
//     team's own voice). NEVER synthesise new wording.
//   • The LLM may combine near-identical phrasings WITHIN one group at naming
//     ("never roll our eyes or scoff"); it may NOT merge across groups.
//   • Behaviours carry their bucket tag; groups span buckets so a bucket split
//     (some say NEVER, some SOMETIMES) is detectable for the clarity assessment.

import Anthropic from "@anthropic-ai/sdk";
import { embedTexts, cosineSim, norm } from "@/lib/embeddings";
import { clusterIndices } from "@/lib/clustering";
import { MODELS } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import type { BehaviorBucket, MemberBehavior, Phase4BehaviourGroup } from "@/types/database";

const DEFAULT_THRESHOLD = Number(process.env.OTIS_CLUSTER_THRESHOLD ?? 0.55);

// Centroid of a set of vectors (component-wise mean).
function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i];
  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  return out;
}

// Dominant bucket = the one with the most DISTINCT members (D-040), amber-first
// tiebreak toward NEVER then ALWAYS (SOMETIMES is the weakest signal).
function dominantBucket(byBucket: Record<BehaviorBucket, Set<string>>): BehaviorBucket {
  const order: BehaviorBucket[] = ["never", "always", "sometimes"];
  let best: BehaviorBucket = "sometimes";
  let bestN = -1;
  for (const b of order) {
    const n = byBucket[b].size;
    if (n > bestN) { bestN = n; best = b; }
  }
  return best;
}

const NAME_GROUPS_TOOL: Anthropic.Tool = {
  name: "name_groups",
  description:
    "Give each behaviour group ONE short canonical name. You may fold near-identical phrasings inside a single group into the name (e.g. \"roll our eyes or scoff\"). Return names in the SAME ORDER as the groups provided. Naming only — never change the grouping.",
  input_schema: {
    type: "object",
    properties: {
      names: {
        type: "array",
        items: { type: "string" },
        description: "One short canonical name per group (2-6 words), staying close to the members' own words. In order.",
      },
    },
    required: ["names"],
  },
};

export type GroupedBehaviours = {
  groups: Phase4BehaviourGroup[];
  memberCount: number; // distinct members who submitted any behaviour
};

// Full single-stream grouping for a team. Deterministic groups + counts; the LLM
// only names. Returns groups sorted by convergence (most members first).
export async function groupTeamBehaviours(
  teamId: string,
  threshold = DEFAULT_THRESHOLD
): Promise<GroupedBehaviours> {
  const { data, error } = await supabase
    .from("member_behaviors")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true }); // stable input order
  if (error) throw new Error(`member_behaviors load failed: ${error.message}`);

  const behaviours = (data ?? []) as MemberBehavior[];
  if (behaviours.length === 0) return { groups: [], memberCount: 0 };

  const vectors = await embedTexts(behaviours.map((b) => b.text));
  const idxGroups = clusterIndices(vectors, threshold);

  const rawGroups = idxGroups.map((idxs) => {
    const members = idxs.map((i) => behaviours[i]);
    const vecs = idxs.map((i) => vectors[i]);

    // Representative wording: source phrasing closest to the group centroid.
    const c = centroid(vecs);
    const cNorm = norm(c);
    let repIdx = 0;
    let repSim = -Infinity;
    idxs.forEach((_, k) => {
      const sim = cNorm === 0 ? 0 : cosineSim(vecs[k], c);
      if (sim > repSim) { repSim = sim; repIdx = k; }
    });

    // Distinct members per bucket (convergence counting).
    const byBucket: Record<BehaviorBucket, Set<string>> = {
      never: new Set(), sometimes: new Set(), always: new Set(),
    };
    for (const b of members) byBucket[b.bucket].add(b.member_id);

    const distinctMembers = new Set(members.map((b) => b.member_id)).size;
    const bucketsUsed = (["never", "sometimes", "always"] as BehaviorBucket[]).filter(
      (b) => byBucket[b].size > 0
    );

    return {
      representative: members[repIdx].text,
      bucket: dominantBucket(byBucket),
      member_count: distinctMembers,
      never_members: byBucket.never.size,
      sometimes_members: byBucket.sometimes.size,
      always_members: byBucket.always.size,
      bucket_split: bucketsUsed.length > 1,
      _texts: members.map((b) => b.text),
    };
  });

  // Name the groups (LLM naming only — counts untouched).
  const names = await nameGroups(rawGroups.map((g) => g._texts));

  const groups: Phase4BehaviourGroup[] = rawGroups.map((g, i) => ({
    name: names[i] || g.representative,
    representative: g.representative,
    bucket: g.bucket,
    member_count: g.member_count,
    never_members: g.never_members,
    sometimes_members: g.sometimes_members,
    always_members: g.always_members,
    bucket_split: g.bucket_split,
  }));

  // Rank by convergence (most members first), then raw size.
  groups.sort((a, b) => b.member_count - a.member_count || b.representative.localeCompare(a.representative));

  const memberCount = new Set(behaviours.map((b) => b.member_id)).size;
  return { groups, memberCount };
}

async function nameGroups(groupTexts: string[][]): Promise<string[]> {
  if (groupTexts.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return groupTexts.map(() => "");

  const listing = groupTexts
    .map((texts, i) => `Group ${i}: ${texts.map((t) => `"${t}"`).join(", ")}`)
    .join("\n");

  const system = `You name groups of near-synonymous team-behaviour entries for a consultant dashboard. Each group is behaviours members phrased in similar ways.

For each group produce ONE short canonical name (2-6 words) that captures what the grouped entries share, staying very close to the members' own language. You may fold near-identical phrasings within a group into the name ("never roll our eyes or scoff"). Do NOT invent behaviours not present, and do NOT merge groups. Return exactly one name per group, in order. This is naming only — it must not change the grouping.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODELS.clusterNaming,
      max_tokens: 1024,
      system,
      tools: [NAME_GROUPS_TOOL],
      tool_choice: { type: "tool", name: "name_groups" },
      messages: [{ role: "user", content: `Name these ${groupTexts.length} groups:\n\n${listing}` }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "name_groups"
    );
    const input = toolUse?.input as { names?: string[] } | undefined;
    return groupTexts.map((_, i) => (input?.names?.[i] ?? "").trim());
  } catch (err) {
    console.error("[behaviourGrouping] naming failed:", err instanceof Error ? err.message : err);
    return groupTexts.map(() => "");
  }
}
