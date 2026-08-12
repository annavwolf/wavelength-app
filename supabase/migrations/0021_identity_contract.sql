-- ============================================================================
-- Workstream B — Identity split, PART 2: contract (removes old columns)
--
-- ⚠  RUN THIS ONLY AFTER:
--   1. 0020_identity_expand.sql has been applied to production.
--   2. The updated application code has been deployed and verified — every
--      route that previously read members.email or members.display_name now
--      reads from member_identity instead.
--   3. Spot-checked that member creation (POST /api/teams/:id/members) is
--      correctly writing to member_identity and NOT relying on these columns.
--
-- VERIFY before running:
--   -- Confirm no new rows have NULL in member_identity (would mean a member
--   -- was created after 0020 but before the code deploy):
--   SELECT m.member_id FROM members m
--     LEFT JOIN member_identity mi USING (member_id)
--     WHERE mi.member_id IS NULL;    -- must return 0 rows
--
--   -- Confirm identity data is intact:
--   SELECT count(*) FROM member_identity;   -- must equal members count
-- ============================================================================

BEGIN;

ALTER TABLE public.members
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS display_name;

COMMIT;
