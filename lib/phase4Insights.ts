// Phase 4 self-serve §3 (agreement) + §4 (clarity assessment) + §5 (distributions).
//
// Consumes the deterministic behaviour groups (lib/behaviourGrouping) plus member
// stories (situation tags), the §1 context responses, and the Phase 2 geographic
// network. Produces everything the consultant dashboard shows and everything the
// artifacts get filled with. Behaviour WORDING is always the team's own
// representative phrasing — never synthesised (spec §2/§3).

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/models";
import { groupTeamBehaviours } from "@/lib/behaviourGrouping";
import { renderAgreementSentence } from "@/lib/agreementText";
import { ACTION_PHRASES } from "@/prompts/phase3_conversation";
import type { Networks } from "@/components/dashboard/types";
import type {
  Phase3ContextResponse,
  Phase4Agreement,
  Phase4BehaviourGroup,
  Phase4Clarity,
  Phase4ClarityState,
  Phase4Distribution,
  Phase4SelfServeJson,
  SituationTag,
} from "@/types/database";

// ── Locked exit-interview text (spec §6.2 / §6.5) ────────────────────────────
export const WHAT_TO_DO_NEXT = `The Team Agreement I've drawn up is probably not perfect. It'll be much better if your team discusses it, tweaks it, and finalises it together. That's why I'd suggest holding a team meeting for this.

Forming the agreement is half the challenge. The other half is a game plan to see it through — how you'll respond when NEVER and ALWAYS behaviours come up, and how you'll check in as a team. I'd suggest building that together, and committing to it for 30 days.`;

export const CLOSING_NOTE = `If your team would like a facilitator to run this with you, Wavelength offers that.`;

const SITUATION_PHRASE: Record<SituationTag, string> = {
  meeting: "meetings",
  async_chat: "chat and messaging",
  email: "email",
  document: "shared documents",
  project_task: "project work",
  other: "day-to-day work",
};

// ── Agreement (§3) ───────────────────────────────────────────────────────────

function topByBucket(groups: Phase4BehaviourGroup[], bucket: "never" | "always"): Phase4BehaviourGroup[] {
  return groups
    .filter((g) => g.bucket === bucket)
    .sort((a, b) => b.member_count - a.member_count);
}

// LLM severity ranking (criticality tiebreak, §3). Returns rank per input index
// (0 = most severe). Lenient: identity order on any failure.
async function severityOrder(reps: string[]): Promise<number[]> {
  const identity = reps.map((_, i) => i);
  if (reps.length <= 1) return identity;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return identity;

  const TOOL: Anthropic.Tool = {
    name: "rank_severity",
    description: "Rank NEVER behaviours from most to least severe/harmful to psychological safety.",
    input_schema: {
      type: "object",
      properties: {
        order: {
          type: "array",
          items: { type: "number" },
          description: "The input indices, most-severe first. Include every index exactly once.",
        },
      },
      required: ["order"],
    },
  };
  try {
    const anthropic = new Anthropic({ apiKey });
    const listing = reps.map((t, i) => `${i}: "${t}"`).join("\n");
    const response = await anthropic.messages.create({
      model: MODELS.clusterNaming,
      max_tokens: 256,
      system: `You rank harmful team behaviours by severity for psychological safety. More severe = more damaging (e.g. "yell and insult" outranks "roll eyes"). Return every index exactly once, most severe first.`,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "rank_severity" },
      messages: [{ role: "user", content: `Rank these:\n${listing}` }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "rank_severity"
    );
    const order = (toolUse?.input as { order?: number[] } | undefined)?.order;
    if (!Array.isArray(order) || order.length !== reps.length) return identity;
    // order[k] = index placed at severity rank k → invert to rank per index.
    const rank = new Array<number>(reps.length).fill(reps.length);
    order.forEach((idx, k) => { if (idx >= 0 && idx < reps.length) rank[idx] = k; });
    return rank;
  } catch (err) {
    console.error("[phase4Insights] severity rank failed:", err instanceof Error ? err.message : err);
    return identity;
  }
}

// Pick top 2-3 NEVER (severity tiebreak) and top 2-3 ALWAYS behaviours.
async function selectBehaviours(groups: Phase4BehaviourGroup[]): Promise<{ never: string[]; always: string[] }> {
  const neverGroups = topByBucket(groups, "never");
  const alwaysGroups = topByBucket(groups, "always");

  // Severity tiebreak among NEVER: stable-sort by (member_count desc, severity asc).
  const sevRank = await severityOrder(neverGroups.map((g) => g.representative));
  const neverRanked = neverGroups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.member_count - a.g.member_count || sevRank[a.i] - sevRank[b.i])
    .map((x) => x.g);

  const take = (arr: Phase4BehaviourGroup[]) => arr.slice(0, 3).map((g) => g.representative);
  return { never: take(neverRanked), always: take(alwaysGroups) };
}

// Situations: top 1-2 story contexts by member convergence (§3).
function selectSituations(storyTagCounts: Map<SituationTag, number>): string[] {
  const sorted = Array.from(storyTagCounts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 2).map(([tag]) => SITUATION_PHRASE[tag]);
}

// ── Clarity assessment (§4) ──────────────────────────────────────────────────

function assessClarity(
  groups: Phase4BehaviourGroup[],
  memberCount: number,
  situationConvergence: "strong" | "weak"
): Phase4Clarity {
  const topNever = topByBucket(groups, "never").slice(0, 2);
  const topAlways = topByBucket(groups, "always").slice(0, 2);
  const total = Math.max(memberCount, 1);

  // Signal 1 — convergence.
  const anchors = [...topNever, ...topAlways];
  const haveTwoEach = topNever.length >= 2 && topAlways.length >= 2;
  const allHalf = haveTwoEach && anchors.every((g) => g.member_count / total >= 0.5);
  const allTwo = anchors.length > 0 && anchors.every((g) => g.member_count >= 2);
  const convergence: "strong" | "moderate" | "weak" = allHalf ? "strong" : allTwo ? "moderate" : "weak";

  // Signal 2 — bucket disagreement among the top-4 behaviours.
  const top4 = [...groups].sort((a, b) => b.member_count - a.member_count).slice(0, 4);
  const splits = top4.filter((g) => g.bucket_split);
  const splitNames = splits.map((g) => g.representative);

  // Combined state (§4 table).
  let state: Phase4ClarityState;
  if (convergence === "strong" && splits.length === 0 && situationConvergence === "strong") {
    state = "clear";
  } else if (convergence === "weak" || splits.length >= 2 || situationConvergence === "weak") {
    state = "unclear";
  } else {
    state = "mixed";
  }

  let message: string;
  if (state === "clear") {
    message = "Your team converged strongly. Use the meeting to confirm, then move to the game plan.";
  } else if (state === "mixed") {
    message = splitNames.length
      ? `Mostly aligned. Discuss "${splitNames[0]}" — members placed it differently.`
      : "Mostly aligned. Use the meeting to confirm the agreement, then move to the game plan.";
  } else {
    message = "Your team hasn't converged yet. Spend most of your meeting agreeing on the agreement itself before the game plan.";
  }

  return { state, message, split_behaviours: splitNames, scattered_situations: situationConvergence === "weak" };
}

// ── Distributions (§5) ───────────────────────────────────────────────────────

function tally(values: (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) if (v) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

function commitmentDistribution(rows: Phase3ContextResponse[]): { dist: Phase4Distribution; lowNote: string | null } {
  const counts = tally(rows.map((r) => r.commitment));
  const total = rows.filter((r) => r.commitment).length;
  const yes = counts["Yes"] ?? 0;
  const summary = total
    ? `${yes} of ${total} said Yes, ${counts["It depends"] ?? 0} said It depends, ${counts["I don't think so"] ?? 0} said I don't think so.`
    : "No commitment responses yet.";
  const lowNote =
    total > 0 && yes < total / 2
      ? "Commitment is broadly low. Low commitment may limit how effective behaviour-change strategies are; building commitment may need to come first."
      : null;
  return { dist: { counts, summary }, lowNote };
}

function touchpointDistribution(
  rows: Phase3ContextResponse[],
  networks: Networks | null
): { dist: Phase4Distribution; note: string | null; asyncSkew: boolean } {
  const counts = tally(rows.map((r) => r.synchronicity));
  const total = rows.filter((r) => r.synchronicity).length;
  const hard = (counts["Easier with some people, but not everyone"] ?? 0) + (counts["Not easy, we rarely do this"] ?? 0);
  const asyncSkew = total > 0 && hard >= Math.ceil(total / 2);
  const timezones = networks?.geographic?.distinct_timezones ?? 1;

  const summary = total
    ? `${counts["Easy, we do it regularly"] ?? 0} meet easily, ${counts["It happens occasionally"] ?? 0} occasionally, ${counts["Easier with some people, but not everyone"] ?? 0} easier with some, ${counts["Not easy, we rarely do this"] ?? 0} rarely.`
    : "No synchronicity responses yet.";

  let note: string | null = null;
  if (total > 0) {
    if (asyncSkew && timezones > 1) {
      note = `Meeting synchronously looks hard, and the team spans ${timezones} timezones — lean on the asynchronous adaptations rather than assuming a live meeting.`;
    } else if (asyncSkew) {
      note = "Meeting synchronously looks hard for this team — the async adaptations will matter even though the team shares a timezone.";
    } else if (timezones > 1) {
      note = `The team meets easily despite spanning ${timezones} timezones — a live meeting is realistic.`;
    } else {
      note = "The team meets easily and shares a timezone — a live meeting is realistic.";
    }
  }
  return { dist: { counts, summary }, note, asyncSkew };
}

// ── Roadmap (§5) ─────────────────────────────────────────────────────────────

function buildRoadmap(clarity: Phase4Clarity): string {
  const base =
    "Hold one team meeting to finalise the agreement and build a 30-day game plan, then run a short weekly check-in for four weeks with continuous in-the-moment reinforcement.";
  if (clarity.state === "unclear") {
    return `${base} Because the team hasn't converged yet, spend most of the meeting agreeing on the agreement itself before the game plan.`;
  }
  if (clarity.state === "mixed") {
    return `${base} The team is mostly aligned — confirm the agreement quickly and give a little time to the behaviours members placed differently.`;
  }
  return `${base} The team converged strongly, so the meeting can confirm the agreement and move straight to the game plan.`;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export type GeneratedInsights = Omit<Phase4SelfServeJson, "artifacts" | "released_at" | "sent_member_ids">;

export async function generatePhase4Insights(
  teamId: string,
  focusStatementId: number,
  focusStatementText: string,
  networks: Networks | null
): Promise<GeneratedInsights> {
  const [{ groups, memberCount }, storiesRes, contextRes] = await Promise.all([
    groupTeamBehaviours(teamId),
    supabase.from("member_stories").select("member_id, situation_tag").eq("team_id", teamId),
    supabase.from("phase3_context_responses").select("*").eq("team_id", teamId),
  ]);

  // Situation convergence from story tags (distinct members per tag).
  const tagMembers = new Map<SituationTag, Set<string>>();
  for (const s of storiesRes.data ?? []) {
    const tag = s.situation_tag as SituationTag | null;
    if (!tag) continue;
    if (!tagMembers.has(tag)) tagMembers.set(tag, new Set());
    tagMembers.get(tag)!.add(s.member_id);
  }
  const tagCounts = new Map<SituationTag, number>();
  for (const [tag, set] of Array.from(tagMembers.entries())) tagCounts.set(tag, set.size);
  const maxTag = Math.max(0, ...Array.from(tagCounts.values()));
  const situationConvergence: "strong" | "weak" = maxTag >= 2 ? "strong" : "weak";

  const contextRows = (contextRes.data ?? []) as Phase3ContextResponse[];

  // Agreement.
  const psItem = ACTION_PHRASES[focusStatementId] ?? focusStatementText;
  const { never, always } = await selectBehaviours(groups);
  const agreement: Phase4Agreement = {
    ps_item: psItem,
    situations: selectSituations(tagCounts),
    always,
    never,
  };
  const agreementText = renderAgreementSentence(agreement);

  // Clarity + distributions.
  const clarity = assessClarity(groups, memberCount, situationConvergence);
  const { dist: commitmentDist, lowNote } = commitmentDistribution(contextRows);
  const { dist: touchpointDist, note: touchpointNote, asyncSkew } = touchpointDistribution(contextRows, networks);

  return {
    behaviour_board: groups,
    agreement,
    clarity,
    commitment_distribution: commitmentDist,
    touchpoint_distribution: touchpointDist,
    low_commitment_note: lowNote,
    touchpoint_note: touchpointNote,
    roadmap: buildRoadmap(clarity),
    agreement_text: agreementText,
    what_to_do_next: WHAT_TO_DO_NEXT,
    closing_note: CLOSING_NOTE,
    otis_original: {
      agreement_text: agreementText,
      what_to_do_next: WHAT_TO_DO_NEXT,
      closing_note: CLOSING_NOTE,
    },
    async_skew: asyncSkew,
  };
}
