-- Durable Phase 1 resume checkpoints.
--
-- The assessment is intentionally interruptible. Store the next screen a
-- participant should see separately from privacy acknowledgement state so a
-- current acknowledgement never sends someone back to the notice on return.
-- `phase1_return_to_review` preserves the short edit-from-review detour too.

begin;

alter table public.members
  add column if not exists phase1_resume_step text,
  add column if not exists phase1_return_to_review boolean not null default false;

alter table public.members
  drop constraint if exists members_phase1_resume_step_check;

alter table public.members
  add constraint members_phase1_resume_step_check
  check (
    phase1_resume_step is null
    or phase1_resume_step in (
      'landing',
      'profile',
      'roster',
      'profile_details',
      'purpose',
      'team_name',
      'own_role',
      'coordination',
      'ps_why',
      'faq',
      'ps_descent',
      'ps_diagnostic',
      'ps_importance',
      'what_happens_next',
      'review',
      'close'
    )
  );

commit;
