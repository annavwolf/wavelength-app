-- Track completion of the Phase 3 pre-workshop activity per member.
--
-- Previously the only per-member completion signal was members.status =
-- 'complete', which is set at the end of the Phase 1 ASSESSMENT (CloseStep).
-- Finishing the Phase 3 activity flipped only the client view and wrote nothing,
-- so the dashboard "members finished" count and the Team Agreement
-- "Generate insights" gate were really measuring Phase 1, not Phase 3.
--
-- phase3_completed_at is written when a member submits the Phase 3 review
-- (app/me/phase3 → "done"). NULL means the member has not finished Phase 3.
-- Optional/back-compat: existing rows stay NULL until a member next completes.

alter table members
  add column if not exists phase3_completed_at timestamptz;
