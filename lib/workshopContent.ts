// Phase 4 workshop content + pure helpers.
// Spec: Otis_Build_Handover_v1/Otis_Phase4_Workshop_Spec_v1.md.
//
// The facilitation SCRIPTS (§3–§7) and the REINFORCEMENT LIBRARY (§6.5) are
// explicitly editable content, NOT hard-coded product logic — Anna will refine
// the scripts and author a proper Reinforcement Library for the beta. They live
// here as data so they can change without touching the panel. Do not inline them
// into components. (Spec §6.5, §11.)

import type { BehaviourItem, PairSubmission, WorkshopPhase } from "@/types/database";

// ── Movements ───────────────────────────────────────────────────────────────
// The five movements plus setup/closed bookends. `member_title` is what the room
// sees; `label` is the facilitator's short name.
export type MovementId = Exclude<WorkshopPhase, "setup" | "closed">;

export type Movement = {
  id: MovementId;
  label: string;
  member_title: string;
  minutes: number;
};

export const MOVEMENTS: Movement[] = [
  { id: "orient",        label: "M1 · Orient",         member_title: "Let's get oriented",        minutes: 6 },
  { id: "pairs",         label: "M2 · Pairs",          member_title: "In your pairs",             minutes: 12 },
  { id: "whole_team",    label: "M3 · Share & select", member_title: "As a whole team",           minutes: 15 },
  { id: "reinforcement", label: "M4 · Reinforcement",  member_title: "Making it stick",           minutes: 12 },
  { id: "agreement",     label: "M5 · The agreement",  member_title: "Our agreement",             minutes: 10 },
];

export const MOVEMENT_ORDER: WorkshopPhase[] =
  ["setup", "orient", "pairs", "whole_team", "reinforcement", "agreement", "closed"];

export function nextPhase(p: WorkshopPhase): WorkshopPhase {
  const i = MOVEMENT_ORDER.indexOf(p);
  return i >= 0 && i < MOVEMENT_ORDER.length - 1 ? MOVEMENT_ORDER[i + 1] : p;
}
export function prevPhase(p: WorkshopPhase): WorkshopPhase {
  const i = MOVEMENT_ORDER.indexOf(p);
  return i > 0 ? MOVEMENT_ORDER[i - 1] : p;
}

// ── Facilitator scripts (editable content) ──────────────────────────────────
// Private to the facilitator's panel — never shown in the member room.
export const FACILITATOR_SCRIPTS: Record<MovementId, string[]> = {
  orient: [
    "Welcome everyone. Remind them: this is a starting point, not a verdict. Everything we look at came from them.",
    "Read the norms aloud: open mind · everyone speaks · don't interrupt · we'll revisit this.",
    "Warm-up round: one word each — how are you arriving today? (Gets every voice into the room in the first five minutes — do not cut it.)",
  ],
  pairs: [
    "Put people into the pairs below. Remote: create breakout rooms matching these pairs. In person: turn to your partner.",
    "Each pair agrees on the 2 behaviours they most want to see (ALWAYS) and the 2 they least want to see (NEVER) in this situation.",
    "For each pick: how would we actually know we're doing it — what would someone see or hear? They type that on their pair sheet.",
  ],
  whole_team: [
    "Go pair by pair. Ask each: \"Which two did you pick, and why did you choose those?\" One pair at a time; hold reactions until all have spoken.",
    "Then open it up: \"Okay, now it's open. What are you noticing?\"",
    "Use Otis's recommendation below to decide: take the clear picks, or run a quick vote where it's tied. Hard cap: 3 ALWAYS and 3 NEVER.",
  ],
  reinforcement: [
    "\"We're not going to be perfect at this. People will slip, and we'll all forget sometimes. So rather than hope, let's put something in place to keep this alive.\"",
    "Walk the three mechanisms below; the team chooses and adapts — they own the choice, not the invention.",
    "Everyone has the authority to reinforce; the leader has the responsibility to go first.",
    "Roleplay it once (10–30s): \"[Name], pretend [name] just talked over you — use the signal.\" Rehearsing makes it far more likely to be used.",
  ],
  agreement: [
    "Read the assembled agreement aloud. Then: \"Does this sound like us? Change anything that doesn't.\" You hold the pen; the team calls out changes.",
    "Fist-of-five: \"On three, hold up one to five fingers. Five means fully behind this. One means I can't commit. Anything below three — I want to hear from you.\"",
    "If anyone is below 3: \"What would get you to a three?\" Adjust, re-check. Then lock it.",
  ],
};

// ── Reinforcement Library (⚠ PLACEHOLDER content — spec §6.5) ────────────────
// The three MECHANISMS are locked structure. The specific scripts/signals/options
// inside them are placeholder for the beta and will be replaced wholesale by
// Anna's authored library. Treated as editable content, never hard-coded logic.
export type ReinforcementMechanism = {
  key: "reflection" | "interrupt" | "positive";
  title: string;
  blurb: string;
  options: string[];
};

export const REINFORCEMENT_LIBRARY: ReinforcementMechanism[] = [
  {
    key: "reflection",
    title: "Scheduled reflection — a recurring check-in",
    blurb: "Cue-based, not meeting-based. Anchor it to their situation: \"at the end of [the situation], or the next time you're together after it.\"",
    options: [
      "At the end of an existing recurring meeting",
      "Added to your retro",
      "A short async check-in message",
      "At the start of the next [context]",
    ],
  },
  {
    key: "interrupt",
    title: "In-the-moment interrupt — when a NEVER happens live",
    blurb: "Pick what the team is ready for. The collective \"we\" is the key linguistic move and it is teachable.",
    options: [
      "A neutral signal — an agreed hand raise, emoji, or code word (low-confrontation, works remotely)",
      "A short scripted phrase naming the behaviour not the person — \"Can we pause — I think we're talking over each other.\"",
      "Defer to the reflection — note it, raise it at the check-in",
    ],
  },
  {
    key: "positive",
    title: "Positive reinforcement — the one teams forget",
    blurb: "Name the specific behaviour, not a generic compliment. Everyone has the authority to do this, not only the leader.",
    options: [
      "\"I noticed you paused so [name] could finish — that's exactly the thing.\"",
      "A standing habit: one specific appreciation at the check-in",
      "In-the-moment, in the channel where it happened",
    ],
  },
];

// Stall-breaker suggestions for the "suggest options" button (spec §6.3).
export const CAPTURE_SUGGESTIONS = {
  check_trigger: [
    "At the end of an existing recurring meeting",
    "Added to your retro",
    "A short async check-in message",
    "At the start of the next [context]",
  ],
  when_someone_slips: [
    "An agreed neutral signal (hand raise / emoji / code word)",
    "A scripted phrase: \"Can we pause — I think we're [behaviour].\"",
    "Note it and raise it at the check-in",
  ],
  when_done_well: [
    "Name the specific behaviour in the moment",
    "One specific appreciation at each check-in",
  ],
};

// ── Size-adaptive structure (spec §8) ───────────────────────────────────────
export type Structure = { supported: boolean; headline: string; detail: string };

export function computeStructure(n: number): Structure {
  if (n < 2) {
    return { supported: false, headline: "Not enough participants",
      detail: "The workshop needs at least a pair. Wait for more members to arrive." };
  }
  if (n > 12) {
    return { supported: false, headline: `${n} is over the supported maximum (12)`,
      detail: "Split into two sessions. The two-workshop merge case is deferred post-beta — run them separately for now." };
  }
  const pairs = Math.floor(n / 2);
  const trio = n % 2 === 1;
  const pairing = `${pairs} ${pairs === 1 ? "pair" : "pairs"}${trio ? " + 1 trio" : ""}`;
  if (n <= 5) {
    return { supported: true, headline: `${n} people → ${pairing} → whole team`,
      detail: "Pairs (one trio if odd) → whole team. No extra structure needed." };
  }
  if (n <= 8) {
    return { supported: true, headline: `${n} people → ${pairing} → whole team`,
      detail: "Pairs → whole team, with round-robin enforced at every sharing moment." };
  }
  return { supported: true, headline: `${n} people → ${pairing} → whole team`,
    detail: "Pairs → whole team with round-robin. Sub-groups may be used for M4 if discussion gets unwieldy (your call)." };
}

// ── Pairing (spec §4.1) — beta: random; one trio for odd numbers ────────────
export function generatePairs(memberIds: string[]): string[][] {
  const shuffled = [...memberIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const pairs: string[][] = [];
  // If odd, the last three form a trio; everyone before pairs up cleanly.
  const odd = shuffled.length % 2 === 1;
  const pairableEnd = odd ? shuffled.length - 3 : shuffled.length;
  for (let i = 0; i < pairableEnd; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
  if (odd && shuffled.length >= 3) pairs.push(shuffled.slice(shuffled.length - 3));
  return pairs;
}

// ── Convergence ladder (spec §5.2) ──────────────────────────────────────────
// For a given kind (always/never), count how many pairs picked each behaviour,
// expressed as a proportion of submitted pairs so the logic is size-independent.
export type Tally = { behaviour: string; pairs: number };
export type ConvergenceStatus = "clear" | "tie_second" | "scatter" | "insufficient";
export type Convergence = {
  status: ConvergenceStatus;
  nPairs: number;
  tallies: Tally[];          // sorted desc by pair count
  recommendation: string;    // Otis's prompt to the facilitator
  autoTake: string[];        // behaviours safe to take without a vote (may be empty)
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function computeConvergence(
  submissions: PairSubmission[],
  kind: "always" | "never",
): Convergence {
  const submitted = submissions.filter((s) => s.submitted_at);
  const nPairs = submitted.length;

  // Tally by clearest phrasing: keep the first-seen original casing per key.
  const counts = new Map<string, { display: string; pairs: number }>();
  for (const sub of submitted) {
    const items: BehaviourItem[] = kind === "always" ? sub.always_items : sub.never_items;
    const seenThisPair = new Set<string>();
    for (const it of items ?? []) {
      const key = normalize(it.behaviour);
      if (!key || seenThisPair.has(key)) continue; // a pair counts once per behaviour
      seenThisPair.add(key);
      const cur = counts.get(key);
      if (cur) cur.pairs += 1;
      else counts.set(key, { display: it.behaviour.trim(), pairs: 1 });
    }
  }

  const tallies: Tally[] = Array.from(counts.values())
    .map((v) => ({ behaviour: v.display, pairs: v.pairs }))
    .sort((a, b) => b.pairs - a.pairs);

  const kindLabel = kind === "always" ? "ALWAYS" : "NEVER";

  if (nPairs < 2 || tallies.length === 0) {
    return {
      status: "insufficient", nPairs, tallies, autoTake: [],
      recommendation: `Not enough ${kindLabel} submissions yet to compute a result. Wait for the pairs to submit.`,
    };
  }

  const c0 = tallies[0]?.pairs ?? 0;
  const c1 = tallies[1]?.pairs ?? 0;
  const c2 = tallies[2]?.pairs ?? 0;
  const half = nPairs / 2;

  // Wide scatter — nothing above roughly half the pairs.
  if (c0 <= half && tallies.length > 2) {
    return {
      status: "scatter", nPairs, tallies, autoTake: [],
      recommendation: `No clear front-runners for ${kindLabel} — picks are spread across ${tallies.length} behaviours. Recommend a vote across all of them.`,
    };
  }

  // Tie at the second slot — leader is clear, 2nd and 3rd tied.
  if (c1 > 0 && c1 === c2) {
    return {
      status: "tie_second", nPairs, tallies, autoTake: [tallies[0].behaviour],
      recommendation: `${kindLabel}: "${tallies[0].behaviour}" leads with ${c0} of ${nPairs}. "${tallies[1].behaviour}" and "${tallies[2].behaviour}" are tied at ${c1} each for the second slot. Recommend a quick vote between those two.`,
    };
  }

  // Clear top 2 — two behaviours ahead, no tie at the boundary.
  const top2 = tallies.slice(0, 2).map((t) => t.behaviour);
  const next = tallies[2] ? `Next highest is "${tallies[2].behaviour}" at ${c2}. ` : "";
  return {
    status: "clear", nPairs, tallies, autoTake: top2,
    recommendation: `Clear ${kindLabel} result: "${tallies[0].behaviour}" chosen by ${c0} of ${nPairs} pairs, "${tallies[1].behaviour}" by ${c1}. ${next}Recommend taking both — no vote needed.`,
  };
}

// Carry the observability lines forward from the pair sheets for a chosen
// behaviour (spec §7.1 — this is why M2's structured sheet matters).
export function observabilityFor(
  submissions: PairSubmission[],
  kind: "always" | "never",
  behaviour: string,
): string {
  const key = normalize(behaviour);
  for (const sub of submissions) {
    const items: BehaviourItem[] = kind === "always" ? sub.always_items : sub.never_items;
    for (const it of items ?? []) {
      if (normalize(it.behaviour) === key && it.observability?.trim()) return it.observability.trim();
    }
  }
  return "";
}
