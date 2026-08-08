import type { createBrowserClient } from "@/lib/supabase";

// Shared client type for interview step components — avoids each step file
// re-deriving it from lib/supabase.ts.
export type AppSupabaseClient = ReturnType<typeof createBrowserClient>;

export type InterviewStep =
  | "landing"
  | "profile"
  | "personal_context"
  | "purpose"
  | "team_name"
  | "missing_member"
  | "own_role"
  | "coordination"
  | "ps_why"
  | "consent"
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
