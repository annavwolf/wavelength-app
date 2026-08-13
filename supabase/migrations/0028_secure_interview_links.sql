-- ============================================================================
-- Secure, revocable participant interview links.
--
-- An invite URL is a bearer credential. Store only a SHA-256 hash of its
-- random token, allow several active links per participant (for a re-send or
-- a separate device), and make each link independently revocable. The raw
-- token is created by the server and appears only in the delivery URL.
-- ============================================================================

begin;

create table if not exists public.member_interview_tokens (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(member_id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  last_used_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists member_interview_tokens_member_idx
  on public.member_interview_tokens (member_id, created_at desc);

create index if not exists member_interview_tokens_active_hash_idx
  on public.member_interview_tokens (token_hash)
  where revoked_at is null;

-- Browser clients must never read token hashes or alter token state. The
-- server service-role client bypasses this deny-by-default RLS boundary.
alter table public.member_interview_tokens enable row level security;

commit;
