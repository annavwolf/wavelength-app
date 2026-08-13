-- Early-access entitlement for the beta-only team-agreement features.
--
-- A consultant's entitlement is stored independently from the access code.
-- Codes themselves stay outside the database as SHA-256 hashes in the
-- server-only EARLY_ACCESS_CODE_HASHES environment variable. That makes a
-- code revocable (remove its hash from the environment) without exposing or
-- persisting the raw value, while consultants who have already redeemed one
-- retain their granted beta access.

begin;

alter table public.consultants
  add column if not exists early_access_granted_at timestamptz,
  add column if not exists early_access_grant_source text;

alter table public.consultants
  drop constraint if exists consultants_early_access_grant_source_check;

alter table public.consultants
  add constraint consultants_early_access_grant_source_check
  check (
    early_access_grant_source is null
    or early_access_grant_source in ('code', 'manual')
  );

-- The timestamp is the entitlement. Keeping the source nullable preserves
-- existing consultant rows and allows a support administrator to grant access
-- deliberately with source = 'manual'.
create index if not exists consultants_early_access_granted_at_idx
  on public.consultants (early_access_granted_at)
  where early_access_granted_at is not null;

commit;
