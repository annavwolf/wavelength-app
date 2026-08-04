-- Phase 4 Self-Serve Path (Otis_Phase4_SelfServe_Spec_v1).
--
-- Two additions:
--   1. phase3_context_responses (§1) — the four new Phase 3 questions
--      (impact, frequency, commitment, synchronicity), one row per member/team.
--   2. analysis.phase4_selfserve_json (§0/§6/§7) — the generated self-serve
--      output: grouped behaviour board (member-links removed), drafted
--      agreement, clarity assessment, distributions, roadmap, the editable
--      exit-interview text (+ preserved Otis originals), and the per-team filled
--      artifacts. Mirrors the phase3_report_json pattern (migration 0012).
--      released_at (inside the JSON) tracks whether results have been released.

create table if not exists phase3_context_responses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(member_id) on delete cascade,
  team_id uuid not null references teams(team_id) on delete cascade,
  -- §1.1 — asked after storytelling, before the never/always board.
  impact_text text,
  frequency text check (frequency in (
    'Several times a day',
    'Several times a week',
    'Several times a month',
    'Several times a year'
  )),
  -- §1.2 — asked right before the end of Phase 3.
  commitment text check (commitment in (
    'Yes',
    'It depends',
    'I don''t think so'
  )),
  commitment_comment text,
  synchronicity text check (synchronicity in (
    'Easy, we do it regularly',
    'It happens occasionally',
    'Easier with some people, but not everyone',
    'Not easy, we rarely do this'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per member per team (upsert target in /api/phase3/context).
  unique (member_id, team_id)
);

-- Server routes use the anon-key client; RLS off + explicit grants (mirror 0013).
alter table phase3_context_responses disable row level security;
grant select, insert, update, delete on phase3_context_responses to anon, authenticated;

-- Generated self-serve output, edited by the consultant before release.
alter table analysis
  add column if not exists phase4_selfserve_json jsonb;
