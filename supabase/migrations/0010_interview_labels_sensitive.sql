-- ============================================================================
-- Phase 2 redesign: anonymity guardrail flag on coded labels (Change A).
-- Adds sensitive_specific to interview_labels so the coder can mark labels
-- that are identifiable at a team-of-five level. Default false (safe).
-- Downstream: clustering reads the flag to set all_sensitive on clusters;
-- PreworkReview suppresses those from the workshop-facing behaviour list.
-- ============================================================================

begin;

alter table public.interview_labels
  add column sensitive_specific boolean not null default false;

commit;
