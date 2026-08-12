-- ============================================================================
-- Beta privacy gate, explicit verbatim preference, and withdrawal audit trail.
-- Apply after 0020_identity_expand.sql. This migration is intentionally
-- fail-safe: prior implied opt-ins are reset to false until a participant makes
-- a fresh choice in the beta privacy screen.
-- ============================================================================

begin;

alter table public.teams
  add column if not exists beta_participation_ended_at timestamptz;

create table if not exists public.member_privacy_acknowledgements (
  member_id uuid primary key references public.members(member_id) on delete cascade,
  team_id uuid not null references public.teams(team_id) on delete cascade,
  privacy_notice_version text not null,
  acknowledged_at timestamptz not null default now(),
  verbatim_preference text not null check (verbatim_preference in ('summary_only', 'verbatim')),
  preference_updated_at timestamptz not null default now(),
  voice_input_opt_in boolean not null default false,
  voice_input_opted_in_at timestamptz
);

create index if not exists member_privacy_acknowledgements_team_idx
  on public.member_privacy_acknowledgements (team_id, acknowledged_at);

create table if not exists public.member_withdrawals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(member_id) on delete cascade,
  team_id uuid not null references public.teams(team_id) on delete cascade,
  scope text not null check (scope in ('phase1', 'stories', 'behaviors', 'everything')),
  requested_at timestamptz not null default now(),
  report_was_generated boolean not null default false
);

create index if not exists member_withdrawals_member_idx
  on public.member_withdrawals (member_id, requested_at desc);

-- Privacy acknowledgement and withdrawal records are server-managed only.
alter table public.member_privacy_acknowledgements enable row level security;
alter table public.member_withdrawals enable row level security;

-- Remove the legacy defaults that silently treated participation as consent.
alter table public.members
  alter column share_verbatim_with_team set default false,
  alter column share_name_with_team set default false,
  alter column phase3_story_verbatim set default false,
  alter column phase3_behavior_verbatim set default false;

update public.members
set
  share_verbatim_with_team = false,
  share_name_with_team = false,
  phase3_story_verbatim = false,
  phase3_behavior_verbatim = false;

commit;
