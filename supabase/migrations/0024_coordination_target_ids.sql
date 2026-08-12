-- ============================================================================
-- Make coordination ratings resilient to duplicate or renamed display names.
-- New rows carry a target_member_id; target_member_name remains during the
-- transition so existing dashboard/report code can read older beta records.
-- Apply after 0020_identity_expand.sql.
-- ============================================================================

begin;

alter table public.coordination_ratings
  add column if not exists target_member_id uuid references public.members(member_id) on delete set null;

-- Backfill only unambiguous legacy name matches. Duplicate display names are
-- intentionally left NULL rather than guessing and corrupting a relationship.
with unique_targets as (
  select
    r.id,
    -- PostgreSQL has no min(uuid). There is exactly one row after the
    -- HAVING clause, so taking the first aggregated UUID is deterministic.
    (array_agg(mi.member_id))[1] as target_member_id
  from public.coordination_ratings r
  join public.member_identity mi
    on mi.team_id = r.team_id
   and lower(mi.display_name) = lower(r.target_member_name)
  group by r.id
  having count(*) = 1
)
update public.coordination_ratings r
set target_member_id = unique_targets.target_member_id
from unique_targets
where r.id = unique_targets.id
  and r.target_member_id is null;

create index if not exists coordination_ratings_target_member_idx
  on public.coordination_ratings (team_id, target_member_id);

create unique index if not exists coordination_ratings_member_target_unique
  on public.coordination_ratings (member_id, target_member_id)
  where target_member_id is not null;

commit;
