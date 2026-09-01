-- Persist the exact Phase 3 page and furthest page reached so participants
-- resume reliably across devices rather than relying only on response-count
-- heuristics. Values are validated by the server against PHASE3_STEP_IDS.

alter table public.members
  add column if not exists phase3_resume_step text,
  add column if not exists phase3_reached_step text;
