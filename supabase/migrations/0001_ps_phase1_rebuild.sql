-- ============================================================================
-- Otis Phase 1 rebuild — schema + seed migration
-- Canonical source: v2_rebuild_info/Otis_Phase1_Canonical_Flow_v1.md (§2.1, §9)
-- Run in the Supabase SQL editor. Transaction-wrapped; review before running.
-- ⚠ DESTRUCTIVE: wipes ps_responses and fish_responses (approved — fresh start).
--
-- Confirmed against live DB before finalizing:
--   • members.member_id / teams.team_id are uuid.
--   • ps_statements.construct is nullable → left null for the new items.
--   • ps_responses has RLS DISABLED with zero policies → ps_interview_responses
--     matches that (RLS disabled, no policies), not a new RLS pattern.
-- ============================================================================

begin;

-- ── 1. ps_statements: add reverse_scored, reseed the 12 canonical items ──────
alter table public.ps_statements
  add column if not exists reverse_scored boolean not null default false;

truncate table public.ps_responses;   -- old 3-point data, discarded (approved)
delete from public.ps_statements;      -- clear stale item set before reseed

-- construct left NULL for all 12: old per-item labels don't apply to the new
-- items and replacements haven't been authored (column is nullable).
insert into public.ps_statements
  (statement_id, zone, zone_name, statement_text, construct, reverse_scored)
values
  (1,  1, 'Safe to Belong',       'On this team, everyone treats one another with respect',                                                                        null, false),
  (2,  1, 'Safe to Belong',       'Members of this team accept one another for being different',                                                                   null, false),
  (3,  1, 'Safe to Belong',       'Members of this team feel distant, and some people are on the outside',                                                         null, true),   -- reverse-scored
  (4,  1, 'Safe to Belong',       'In this team, we understand and value one another''s contributions',                                                            null, false),
  (5,  2, 'Safe to Speak Freely', 'If I need help from members of this team, I feel comfortable reaching out',                                                     null, false),
  (6,  2, 'Safe to Speak Freely', 'I feel comfortable sharing my ideas and opinions even if they aren''t fully formed',                                            null, false),
  (7,  2, 'Safe to Speak Freely', 'If I make a mistake or find a problem, I can tell my team without facing criticism or punishment',                             null, false),
  (8,  2, 'Safe to Speak Freely', 'On this team, we give everyone time and attention to express their perspectives',                                              null, false),
  (9,  3, 'Safe to Innovate',     'This team takes time to question how we do things and find ways to improve our work processes',                                null, false),
  (10, 3, 'Safe to Innovate',     'When things go wrong, we look at what happened and what we can learn, not who to blame',                                       null, false),
  (11, 3, 'Safe to Innovate',     'On this team, disagreeing or seeing things differently is welcomed, not just tolerated',                                       null, false),
  (12, 3, 'Safe to Innovate',     'On this team, I feel safe to innovate and take calculated risks, and share the outcome with my team even when something doesn''t work', null, false);

-- ── 2. Wipe legacy fish data (dead-fish steps retired) ───────────────────────
truncate table public.fish_responses;
-- NOT dropping fish / fish_responses tables — the Phase 2 compute route still
-- references them. Retire in a later cleanup once Phase 2 is reworked.

-- ── 3. New table: ps_interview_responses (§9) ────────────────────────────────
-- One row per member per probed item. Reverse-scoring is NEVER applied here;
-- member_response_label stores the literal 5-point rating the member clicked.
create table if not exists public.ps_interview_responses (
  id                     uuid primary key default gen_random_uuid(),
  member_id              uuid not null references public.members(member_id) on delete cascade,
  team_id                uuid not null references public.teams(team_id)   on delete cascade,
  statement_id           int  not null references public.ps_statements(statement_id),
  member_response_label  text check (member_response_label in
                           ('strongly_disagree','disagree','neutral','agree','strongly_agree')),
  situation_text         text,   -- Turn 1  → Phase 2 SITUATION bucket
  out_behavior_text      text,   -- Turn 2  → OUT-BEHAVIOR bucket
  outcome_text           text,   -- Turn 3  → OUTCOME bucket
  in_behavior_text       text,   -- Turn 4  → IN-BEHAVIOR bucket
  is_all_positive_branch boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (member_id, statement_id)   -- one row per member per probed item; enables upsert/resume
);

create index if not exists ps_interview_responses_member_idx
  on public.ps_interview_responses (member_id);

-- ── 4. RLS: match ps_responses exactly — RLS DISABLED, no policies ───────────
alter table public.ps_interview_responses disable row level security;

commit;
