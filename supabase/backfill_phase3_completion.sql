-- ============================================================================
-- ONE-TIME BACKFILL — run once in the Supabase SQL editor.
-- NOT a migration: this file is outside supabase/migrations/ so it never
-- re-runs on future deploys. It touches data only; no schema changes.
-- Idempotent: only fills rows still NULL.
--
-- Purpose: members who finished Phase 3 before phase3_completed_at was added
-- (migration 0018) are still NULL. This stamps them complete.
--
-- Completion signal: the member has submitted at least one behavior to the
-- team's behavior board (member_behaviors). This is the core deliverable of
-- Phase 3 and is present even if later steps (synchronicity, commitment) were
-- skipped or saved before those questions were added to the flow.
-- ============================================================================

update members m
set phase3_completed_at = now()
where m.phase3_completed_at is null
  and exists (
    select 1
    from member_behaviors b
    where b.member_id = m.member_id
  );

-- Check what got marked (optional — uncomment to review):
-- select member_id, display_name, status, phase3_completed_at
-- from members where phase3_completed_at is not null order by phase3_completed_at desc;
