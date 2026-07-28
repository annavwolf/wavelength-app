-- ============================================================================
-- Otis Phase 3 §3.5 — Consultant pre-release review: the "approved workshop seed"
-- Canonical source: Otis_Build_Handover_v1/Otis_Phase3_MemberReport_Spec_v1.md §3.5
-- Decision: D-052 (consultant overrides Otis's item pick + edits seeded behaviours
-- before members see them; provenance tracked Otis/member/consultant).
-- Run in the Supabase SQL editor. Transaction-wrapped; review before running.
--
-- This is the missing data contract (§3.5 "Data implication"): the member sort in
-- Phase 3 §4.2 must read the consultant-APPROVED, possibly-edited behaviour set —
-- NOT raw tier2_json. One current seed per team; edited in place as a draft, then
-- `released_at` is stamped on release. RLS disabled to match the analysis path.
-- ============================================================================

begin;

create table if not exists public.workshop_seed (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(team_id) on delete cascade,
  -- The reviewed focus PS item + its situation, derived from clustering and
  -- overridable by the consultant (D-051 team-level pick, D-052 override).
  statement_id     int,
  zone             int,
  objective        text,   -- "when we want to …"
  context          text,   -- "during …"
  focus_hypothesis text,   -- the direct-voice hypothesis (D-049) shown for context
  -- The final behaviour set the member sort reads. Each entry:
  -- { id, text, kind: 'never'|'always', provenance: 'otis'|'member'|'consultant',
  --   source_statement_id: int|null, original_text: string|null }
  -- provenance + original_text preserve Otis's wording when a consultant edits
  -- (D-052). source_statement_id marks behaviours pulled from the cross-item
  -- library (D-045/D-052) with the item they came from.
  behaviours       jsonb not null default '[]'::jsonb,
  version          int not null default 1,
  is_current       boolean not null default true,
  released_at      timestamptz,          -- null = draft; stamped on "release to team"
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (team_id)
);

-- Supabase projects with "enable RLS on all new tables" re-enable RLS after
-- CREATE TABLE, overriding a same-transaction ALTER. Drop any auto-created
-- policies first, then disable — this order is idempotent regardless of whether
-- the project-level default fired.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'workshop_seed'
  loop
    execute format('drop policy if exists %I on public.workshop_seed', pol.policyname);
  end loop;
end $$;

alter table public.workshop_seed disable row level security;

commit;
