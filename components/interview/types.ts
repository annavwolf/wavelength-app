import type { createBrowserClient } from "@/lib/supabase";

// Shared client type for interview step components — avoids each step file
// re-deriving it from lib/supabase.ts.
export type AppSupabaseClient = ReturnType<typeof createBrowserClient>;

// 'ps_diagnostic' | 'fish' | 'close' are reserved for the next pass — not
// rendered yet, but kept in the union so the progress model doesn't need to
// change shape when they're built.
export type InterviewStep =
  | "landing"
  | "foreshadow"
  | "consent"
  | "profile"
  | "personal_context"
  | "purpose"
  | "roster"
  | "coordination"
  | "ps_intro"
  | "ps_frame"
  | "ps_diagnostic"
  | "ps_reflect"
  | "end_of_pass1"
  | "fish"
  | "close";
