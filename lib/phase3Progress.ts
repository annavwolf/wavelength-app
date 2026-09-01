export const PHASE3_STEP_IDS = [
  "intro",
  "sp_intro",
  "shared_purpose",
  "results",
  "zone1",
  "zone2",
  "zone3",
  "focus",
  "focus2",
  "stories_intro",
  "chat",
  "impact",
  "frequency",
  "story_consent",
  "agreement_intro",
  "examples_meaning",
  "examples_behaviors",
  "board",
  "commit_praise",
  "commit_ask",
  "commit_sync",
  "finish_wellDone",
  "finish_next",
  "behavior_consent",
  "finish_review",
  "review",
] as const;

export type Phase3StepId = (typeof PHASE3_STEP_IDS)[number];

export function isPhase3StepId(value: unknown): value is Phase3StepId {
  return typeof value === "string" && (PHASE3_STEP_IDS as readonly string[]).includes(value);
}
