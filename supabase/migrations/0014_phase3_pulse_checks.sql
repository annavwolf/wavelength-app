-- Phase 3 per-zone pulse checks (§2.5).
-- One row per member per team per read (zone1, zone2, zone3, purpose).
-- Schema decision: new table (feedback_responses was type-only, never created,
-- and its one-row-per-member shape doesn't fit the per-read design).

create table if not exists phase3_pulse_checks (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(member_id) on delete cascade,
  team_id uuid not null references teams(team_id) on delete cascade,
  read_key text not null check (read_key in ('zone1','zone2','zone3','purpose')),
  accuracy_rating text not null check (accuracy_rating in (
    'Not at all accurate',
    'Somewhat accurate',
    'Very accurate',
    'Don''t know',
    'Decline to answer'
  )),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, team_id, read_key)
);

grant select, insert, update, delete on phase3_pulse_checks to anon, authenticated;
