-- Phase 3 rework (Otis_Phase1_Rewrite follow-on for Phase 3):
--   * Two separate confidentiality checks in the member Phase 3 flow — one for
--     stories (§ Team Stories) and one for behaviors (§ Team Agreement). Default
--     opt-in (verbatim + name).
--   * member_behaviors.nudge_text — the coaching warning is now stored so it
--     survives navigation/reload and disappears only when the member resolves it.
--   * phase3_context_responses: commitment_result (the "what do you think the
--     result would be" free text) + reworded synchronicity option set.
--   * phase3_conversation_messages — durable transcript for the story chat and
--     the impact chat so members can leave and pick up where they left off.

-- ── 1. Two Phase 3 consent flags (default opt-in) ──────────────────────────
alter table members
  add column if not exists phase3_story_verbatim boolean not null default true,
  add column if not exists phase3_behavior_verbatim boolean not null default true;

-- ── 2. Persisted coaching warning on a behavior ────────────────────────────
alter table member_behaviors
  add column if not exists nudge_text text;

-- ── 3. Commitment "result" free text + reworded synchronicity ──────────────
alter table phase3_context_responses
  add column if not exists commitment_result text;

-- Reword the synchronicity options. Drop the old CHECK and add the new set
-- (NOT VALID so any pre-existing rows with old wording aren't rejected).
alter table phase3_context_responses
  drop constraint if exists phase3_context_responses_synchronicity_check;

alter table phase3_context_responses
  add constraint phase3_context_responses_synchronicity_check
  check (synchronicity in (
    'Easily, we do it regularly',
    'Pretty easily, we do it occasionally',
    'Not so easy, we do it sometimes',
    'Difficult, we rarely meet all together',
    'It''s easier with some people but not others'
  )) not valid;

-- ── 4. Durable Phase 3 chat transcripts ────────────────────────────────────
-- kind: 'story'  → the Team Stories chat (Phase3Chat)
--       'impact' → the impact chat (Team Stories, after the story)
create table if not exists phase3_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(member_id) on delete cascade,
  team_id uuid not null references teams(team_id) on delete cascade,
  kind text not null check (kind in ('story','impact')),
  -- Full transcript as [{ role, content }, ...] plus any small state we resume.
  messages jsonb not null default '[]'::jsonb,
  state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, team_id, kind)
);

-- Server routes use the anon-key client; RLS off + explicit grants (mirror 0013/0015).
alter table phase3_conversation_messages disable row level security;
grant select, insert, update, delete on phase3_conversation_messages to anon, authenticated;
