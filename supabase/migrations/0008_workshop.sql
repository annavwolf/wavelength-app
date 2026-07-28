-- ============================================================================
-- Otis Phase 4 — Live Workshop schema
-- Canonical source: Otis_Build_Handover_v1/Otis_Phase4_Workshop_Spec_v1.md (§9)
-- Run in the Supabase SQL editor. Transaction-wrapped; review before running.
--
-- Design principle (spec §0): "Otis prepares and scribes. The facilitator
-- conducts. The team decides." Everything is submit-then-display; the only live
-- mechanic is phase-state broadcast. There is NO real-time collaborative editing,
-- so these tables hold artefacts and phase state, never a live document.
--
-- RLS: ps_responses / ps_interview_responses run with RLS DISABLED and no
-- policies (see 0001). These tables match that pattern — the app reaches them
-- through the anon key with RLS off, same as the rest of the workshop path.
-- ============================================================================

begin;

-- ── workshop_sessions ───────────────────────────────────────────────────────
-- One row per team's workshop. Holds the broadcast phase (what movement the room
-- is in — facilitator-triggered, never inferred) plus the artefacts the
-- facilitator scribes as the team decides: the focus frame, the chosen ALWAYS /
-- NEVER behaviours, the M4 capture sheet, and the revisit date.
create table if not exists public.workshop_sessions (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(team_id) on delete cascade,
  -- phase is the broadcast state. 'setup' = not opened yet; the five movements
  -- map to orient → pairs → whole_team → reinforcement → agreement; 'closed'
  -- once the agreement is locked.
  phase         text not null default 'setup'
                check (phase in ('setup','orient','pairs','whole_team','reinforcement','agreement','closed')),
  -- Editable focus frame, pre-filled from the analysis focus hypothesis. Otis
  -- prepares it; the facilitator confirms/edits objective + context before M1.
  -- { item, objective, context, why, zone }
  focus_frame   jsonb,
  -- Otis-assigned pairing: array of pairs, each an array of member_id strings
  -- (one trio for odd numbers). Null until generated in M2.
  pairs         jsonb,
  -- The behaviours the team lands on in M3. Each: { behaviour, observability }.
  -- Observability lines are carried forward from the pair sheets. Hard cap 3 each.
  selected_always jsonb not null default '[]'::jsonb,
  selected_never  jsonb not null default '[]'::jsonb,
  -- M4 capture sheet (facilitator types; team corrects live).
  -- { when_someone_slips, check_trigger, when_done_well, anything_else }
  capture_sheet jsonb not null default '{}'::jsonb,
  revisit_date  date,
  started_at    timestamptz,
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One live session per team keeps the phase broadcast unambiguous.
create unique index if not exists workshop_sessions_team_uniq
  on public.workshop_sessions (team_id);

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'workshop_sessions' loop
    execute format('drop policy if exists %I on public.workshop_sessions', pol.policyname);
  end loop;
end $$;
alter table public.workshop_sessions disable row level security;

-- ── pair_submissions ────────────────────────────────────────────────────────
-- One row per pair per session. The KEY artefact (spec §4.4): the pair's 2 ALWAYS
-- + 2 NEVER picks and, for each, the observability line that makes M5 assemblable.
create table if not exists public.pair_submissions (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workshop_sessions(id) on delete cascade,
  team_id      uuid not null references public.teams(team_id) on delete cascade,
  pair_index   int not null,
  member_ids   uuid[] not null default '{}',
  -- Each entry: { behaviour, observability }. Up to 2 each (spec §4.3).
  always_items jsonb not null default '[]'::jsonb,
  never_items  jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (session_id, pair_index)
);

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'pair_submissions' loop
    execute format('drop policy if exists %I on public.pair_submissions', pol.policyname);
  end loop;
end $$;
alter table public.pair_submissions disable row level security;

-- ── workshop_votes ──────────────────────────────────────────────────────────
-- Only written when the convergence ladder (spec §5.2) calls a vote. Members tap
-- to allocate 2 ALWAYS + 2 NEVER votes; submit-then-reveal (not live tallies).
create table if not exists public.workshop_votes (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.workshop_sessions(id) on delete cascade,
  team_id     uuid not null references public.teams(team_id) on delete cascade,
  member_id   uuid not null references public.members(member_id) on delete cascade,
  kind        text not null check (kind in ('always','never')),
  behaviour   text not null,
  round       int not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists workshop_votes_session_idx
  on public.workshop_votes (session_id, kind);

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'workshop_votes' loop
    execute format('drop policy if exists %I on public.workshop_votes', pol.policyname);
  end loop;
end $$;
alter table public.workshop_votes disable row level security;

commit;
