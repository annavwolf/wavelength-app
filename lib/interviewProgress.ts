// The privacy screen is deliberately excluded: a participant can resume an
// interview only after acknowledging the current privacy notice. Keeping this
// list in one shared module means the browser and API agree about which saved
// checkpoints are safe to restore.
export const PHASE1_RESUME_STEPS = [
  "landing",
  "profile",
  "roster",
  "profile_details",
  "purpose",
  "team_name",
  "own_role",
  "coordination",
  "faq",
  "ps_why",
  "ps_descent",
  "ps_diagnostic",
  "ps_importance",
  "what_happens_next",
  "review",
  "close",
] as const;

export type Phase1ResumeStep = (typeof PHASE1_RESUME_STEPS)[number];

export function isPhase1ResumeStep(value: unknown): value is Phase1ResumeStep {
  return typeof value === "string" && (PHASE1_RESUME_STEPS as readonly string[]).includes(value);
}
