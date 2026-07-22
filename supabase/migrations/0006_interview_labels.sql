-- ============================================================================
-- Stage B / Phase 2 — Coding pass output: interview_labels
-- Companion: Otis_Phase2_Coding_Spec_v1.md §4 (data model), Analytics Spec §2.4.
-- Run in the Supabase SQL editor. Transaction-wrapped; review before running.
--
-- One row per coded label produced by the Phase 2 coding pass over the four
-- free-text buckets in ps_interview_responses. These labels are the INPUT to
-- clustering. Embeddings are computed in-request per compute run (no vector
-- column / pgvector at this scale), so nothing embedding-related is stored here.
--
-- Re-run model: the compute pipeline deletes a team's existing labels and
-- re-inserts fresh ones each run (coding is a pure re-derivation from the
-- stored text), so no unique constraint is needed.
--
-- RLS: DISABLED, matching every other table in this app (the app uses the anon
-- key server-side). Set explicitly here — two prior new tables came up with RLS
-- ON by default and blocked writes with Postgres 42501 (see 0003 / 0004).
-- ============================================================================

begin;

create table if not exists public.interview_labels (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(team_id)   on delete cascade,
  member_id         uuid not null references public.members(member_id) on delete cascade,
  statement_id      int  not null references public.ps_statements(statement_id),
  -- Which bucket this label belongs to (the primary code). Note: the in_behavior
  -- SOURCE field can yield out_behavior codes too, so primary_code is the code,
  -- not the source field — source_field records provenance separately.
  primary_code      text not null check (primary_code in
                      ('situation','out_behavior','outcome','in_behavior')),
  -- The actual coded text, in the member's own words (gerund / context /
  -- objective / outcome). Preserved verbatim per the fidelity rules.
  secondary_label   text not null,
  -- situation only: distinguishes a context label from an objective label.
  sub_type          text check (sub_type in ('context','objective')),
  -- situation only (D-046): the coding pass judged this may not involve multiple
  -- team members; the dashboard can exclude flagged labels and recompute.
  multi_member_flag boolean not null default false,
  -- Which of the four free-text fields the label was extracted from (provenance).
  source_field      text check (source_field in
                      ('situation_text','out_behavior_text','outcome_text','in_behavior_text')),
  created_at        timestamptz not null default now()
);

create index if not exists interview_labels_team_idx      on public.interview_labels (team_id);
create index if not exists interview_labels_member_idx    on public.interview_labels (member_id);
create index if not exists interview_labels_statement_idx on public.interview_labels (statement_id);
create index if not exists interview_labels_primary_idx   on public.interview_labels (primary_code);
create index if not exists interview_labels_secondary_idx on public.interview_labels (lower(secondary_label));

alter table public.interview_labels disable row level security;

commit;
