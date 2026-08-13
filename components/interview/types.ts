// The public Phase 1 roster is intentionally a minimal projection. `roster_key`
// is the team-scoped pseudonymous code used only for coordination ratings; it
// is not a member UUID and never authorizes access to another participant.
export type InterviewRosterMember = {
  roster_key: string;
  display_name: string;
  is_self: boolean;
};

export type InterviewStep =
  | "privacy"
  | "landing"
  | "profile"
  | "profile_details"
  | "purpose"
  | "team_name"
  | "missing_member"
  | "own_role"
  | "coordination"
  | "ps_why"
  | "faq"
  | "ps_descent"
  | "ps_importance"
  | "ps_diagnostic"
  | "what_happens_next"
  | "review"
  | "close"
  | "already_complete"
  // Legacy — kept in union but no longer wired in the flow.
  | "roster"
  | "foreshadow"
  | "ps_intro_open"
  | "ps_intro_close"
  | "ps_frame"
  | "ps_interview"
  | "ps_reflect"
  | "end_of_pass1"
  | "fish";
