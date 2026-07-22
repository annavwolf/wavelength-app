-- ============================================================================
-- Stage A — Member authentication (magic-link login)
-- Companion: Otis_Build_Handover_v1 Architecture doc §4, Phase 4 Spec §1.1.
-- Run in the Supabase SQL editor. Transaction-wrapped; review before running.
--
-- What this adds: a single table backing passwordless email magic-link login
-- for members. No change to `members` — the session itself is a signed cookie
-- (jose JWT), not a DB column. Member auth is deliberately SEPARATE from the
-- consultant's Supabase Auth, so a member session can never grant access to
-- the consultant dashboard.
--
-- RLS: DISABLED with no policies, matching ps_responses / ps_interview_responses.
-- This table is only ever touched by server routes, and only the SHA-256 HASH
-- of a token is stored — never the raw token (which lives only in the email URL).
-- ============================================================================

begin;

-- One row per issued login link. Keyed to EMAIL, not a single member, so the
-- multi-team case (one email on members in several teams) can be resolved with
-- a "which team?" chooser after the link is verified.
create table if not exists public.member_login_tokens (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null,
  token_hash  text        not null,   -- SHA-256 hex of the raw token; raw token never stored
  expires_at  timestamptz not null,   -- short TTL (~30 min); set by the request route
  used_at     timestamptz,            -- set when the link is verified; single-use
  created_at  timestamptz not null default now()
);

create index if not exists member_login_tokens_hash_idx
  on public.member_login_tokens (token_hash);

create index if not exists member_login_tokens_email_idx
  on public.member_login_tokens (lower(email));

alter table public.member_login_tokens disable row level security;

commit;
