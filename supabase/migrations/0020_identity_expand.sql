-- ============================================================================
-- Workstream B — Identity split, PART 1: expand (additive, non-breaking)
--
-- SEQUENCING (two-increment process per spec):
--   Increment 1  →  run this file against a DB COPY first.
--                   Verify with the queries at the bottom, then run on production.
--   (code deploy) → deploy all application changes after this SQL lands.
--   Increment 2  →  run 0021_identity_contract.sql to drop the old columns.
--
-- What this does:
--   1. Creates member_identity — the new home for email + display_name.
--   2. Backfills from existing members rows.
--   3. Makes members.email and members.display_name nullable so new inserts
--      can omit them while the old columns still exist (transition window).
--   4. Enables RLS on member_identity with no policies — only the Postgres
--      service role (which bypasses RLS) can read it. The anon key used by
--      browser clients gets nothing.
--   5. Creates identity_lookup_log for audit trail (B.4).
--
-- VERIFY after running on a copy:
--   SELECT count(*) FROM member_identity;          -- must match members count
--   SELECT count(*) FROM members WHERE email IS NOT NULL;   -- same as above (or less)
--   SELECT m.member_id, mi.email, mi.display_name
--     FROM members m
--     JOIN member_identity mi USING (member_id)
--     LIMIT 5;                                     -- spot-check join
--   SELECT member_id FROM member_identity
--     WHERE lower(email) = 'test@example.com';     -- email lookup works
-- ============================================================================

BEGIN;

-- ── 1. Identity table ─────────────────────────────────────────────────────────
-- Holds email + display_name only. Keyed to member_id (1-to-1 with members).
-- team_id is denormalised here for fast team-scoped queries (e.g. release route).
CREATE TABLE IF NOT EXISTS public.member_identity (
  member_id    uuid PRIMARY KEY REFERENCES public.members(member_id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  email        text,
  display_name text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS member_identity_email_lower_idx
  ON public.member_identity (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS member_identity_team_idx
  ON public.member_identity (team_id);

-- ── 2. Backfill — detect which columns actually exist, then copy them ─────────
-- Uses dynamic SQL so the migration is safe on both fresh copies (where
-- email/display_name may not yet exist on members) and production (where they do).
DO $$
DECLARE
  has_email        boolean;
  has_display_name boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'members'
      AND column_name  = 'email'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'members'
      AND column_name  = 'display_name'
  ) INTO has_display_name;

  IF has_email AND has_display_name THEN
    EXECUTE '
      INSERT INTO public.member_identity (member_id, team_id, email, display_name)
      SELECT m.member_id, m.team_id, m.email, coalesce(m.display_name, '''')
      FROM public.members m
      ON CONFLICT (member_id) DO NOTHING
    ';
  ELSIF has_display_name THEN
    EXECUTE '
      INSERT INTO public.member_identity (member_id, team_id, display_name)
      SELECT m.member_id, m.team_id, coalesce(m.display_name, '''')
      FROM public.members m
      ON CONFLICT (member_id) DO NOTHING
    ';
  ELSE
    -- Neither column exists on this copy — seed identity rows with empty values.
    -- Production will have the real data; this branch only fires on stripped copies.
    INSERT INTO public.member_identity (member_id, team_id, display_name)
    SELECT m.member_id, m.team_id, ''
    FROM public.members m
    ON CONFLICT (member_id) DO NOTHING;
  END IF;
END $$;

-- ── 3. Make old identity columns nullable (transition window) ─────────────────
-- Only alter columns that actually exist — safe on both copies and production.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.members
      ALTER COLUMN display_name DROP NOT NULL,
      ALTER COLUMN display_name SET DEFAULT NULL;
  END IF;
  -- email is already nullable in all known schema versions; no ALTER needed.
END $$;

-- ── 4. RLS on member_identity — no policies = deny all non-service roles ──────
-- The service role used by server API routes bypasses RLS entirely, so it can
-- still read/write. The anon key (browser clients) gets nothing.
ALTER TABLE public.member_identity ENABLE ROW LEVEL SECURITY;

-- ── 5. Audit log — records every time the identity↔response link is used ──────
-- Anna can review this table to see when and why a lookup happened.
CREATE TABLE IF NOT EXISTS public.identity_lookup_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL,     -- which member was looked up
  looked_up_by text        NOT NULL,     -- calling route slug, e.g. 'auth_request'
  purpose      text,                     -- free-text reason
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Deny all non-service access to the audit log too.
ALTER TABLE public.identity_lookup_log ENABLE ROW LEVEL SECURITY;

COMMIT;
