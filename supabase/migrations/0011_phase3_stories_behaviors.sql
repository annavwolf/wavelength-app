-- Phase 3 storage: member stories + member behaviors.
-- Stories: one per member per team (the brief story about the team-selected item).
-- Behaviors: what members typed into the NEVER/SOMETIMES/ALWAYS board.

create table if not exists member_stories (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(member_id) on delete cascade,
  team_id uuid not null references teams(team_id) on delete cascade,
  statement_id integer references ps_statements(statement_id),
  story_text text not null,
  story_order integer not null default 1,
  -- Filled by the deferred situation-tagger; null until that pass runs.
  situation_tag text check (situation_tag in ('meeting','async_chat','email','document','project_task','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One story per member per team per item (upsert target in conversation route).
  unique (member_id, team_id, statement_id)
);

create table if not exists member_behaviors (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(member_id) on delete cascade,
  team_id uuid not null references teams(team_id) on delete cascade,
  statement_id integer references ps_statements(statement_id),
  bucket text not null check (bucket in ('never','sometimes','always')),
  text text not null,
  -- 'member' = typed by member; 'consultant' = added or edited by consultant in PreworkReview.
  source text not null default 'member' check (source in ('member','consultant')),
  -- True when a coaching nudge was shown and the member submitted anyway.
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
