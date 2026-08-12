-- ============================================================================
-- Migration 0022 — Pseudonymised consultant views + atomic identity lookup
--
-- WHAT THIS DOES:
--   1. Creates five pseudonymised VIEWs that replace member_id with the
--      opaque participant code (e.g. "P101"). These are the ONLY entry point
--      through which response data is exposed without also resolving identity.
--      The consultant dashboard must query these views, not raw tables.
--
--   2. Creates lookup_participant(member_id, reason) — a SECURITY DEFINER
--      function that atomically SELECTs from member_identity and writes to
--      identity_lookup_log. Any code path that resolves member_id → email
--      MUST go through this function so the audit trail can never be skipped.
--
-- WHEN TO RUN:
--   Run this after 0020 and 0021 are confirmed applied and the code deploy
--   is live. It is safe to run in isolation — it only creates views and a
--   function, it does not touch or drop any data.
--
-- VERIFY after running:
--   SELECT participant_code, zone, label FROM consultant_view_ps_responses LIMIT 5;
--   SELECT participant_code, purpose_text FROM consultant_view_purpose_responses LIMIT 5;
--   SELECT participant_code, bucket, text FROM consultant_view_behaviors LIMIT 5;
--   SELECT lookup_participant('<any real member_id uuid>', 'test');
--   SELECT * FROM identity_lookup_log ORDER BY created_at DESC LIMIT 3;
--   -- The last query should show a new row with looked_up_by = 'lookup_participant_fn'.
-- ============================================================================

BEGIN;

-- ── 1. Pseudonymised views ────────────────────────────────────────────────────
-- Each view joins a response table to members to swap member_id → private_code.
-- None of these views touch member_identity, so email is structurally absent.

-- PS survey scores.
CREATE OR REPLACE VIEW public.consultant_view_ps_responses AS
SELECT
  m.private_code  AS participant_code,
  m.team_id,
  r.statement_id,
  r.zone,
  r.label,
  r.response_value,
  r.round,
  r.created_at
FROM public.ps_responses r
JOIN public.members m USING (member_id);

-- Qualitative interview answers.
CREATE OR REPLACE VIEW public.consultant_view_interview_responses AS
SELECT
  m.private_code            AS participant_code,
  m.team_id,
  r.statement_id,
  r.member_response_label,
  r.situation_text,
  r.out_behavior_text,
  r.outcome_text,
  r.in_behavior_text,
  r.is_all_positive_branch,
  r.created_at
FROM public.ps_interview_responses r
JOIN public.members m USING (member_id);

-- Shared purpose statements.
CREATE OR REPLACE VIEW public.consultant_view_purpose_responses AS
SELECT
  m.private_code  AS participant_code,
  m.team_id,
  r.purpose_text,
  r.created_at
FROM public.purpose_responses r
JOIN public.members m USING (member_id);

-- Phase 3 stories.
CREATE OR REPLACE VIEW public.consultant_view_stories AS
SELECT
  m.private_code  AS participant_code,
  m.team_id,
  s.statement_id,
  s.story_text,
  s.story_order,
  s.situation_tag,
  s.created_at
FROM public.member_stories s
JOIN public.members m USING (member_id);

-- Phase 3 / workshop behaviours.
CREATE OR REPLACE VIEW public.consultant_view_behaviors AS
SELECT
  m.private_code  AS participant_code,
  m.team_id,
  b.statement_id,
  b.bucket,
  b.text,
  b.source,
  b.flagged,
  b.created_at
FROM public.member_behaviors b
JOIN public.members m USING (member_id);

-- ── 2. Atomic identity lookup function ────────────────────────────────────────
-- Resolves member_id → identity row AND writes an audit log entry in the same
-- call. SECURITY DEFINER means it runs with the owner's privileges (service
-- role), so it can read member_identity regardless of the caller's RLS context.
--
-- Usage (from a Supabase SQL editor session or an admin script):
--   SELECT * FROM lookup_participant('<member_id_uuid>', 'password reset – ticket #42');
--
-- The audit log entry is written BEFORE the SELECT so a failed lookup still
-- leaves a trace (useful for detecting probing attempts).

CREATE OR REPLACE FUNCTION public.lookup_participant(
  p_member_id uuid,
  p_reason    text
)
RETURNS TABLE (
  member_id    uuid,
  team_id      uuid,
  email        text,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.identity_lookup_log (member_id, looked_up_by, purpose)
  VALUES (p_member_id, 'lookup_participant_fn', p_reason);

  RETURN QUERY
  SELECT mi.member_id, mi.team_id, mi.email, mi.display_name
  FROM   public.member_identity mi
  WHERE  mi.member_id = p_member_id;
END;
$$;

-- Only the service role and superuser can call this function.
-- Removes the default PUBLIC grant so the anon/authenticated roles cannot call it.
REVOKE EXECUTE ON FUNCTION public.lookup_participant(uuid, text) FROM PUBLIC;

COMMIT;
