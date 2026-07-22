-- ============================================================================
-- Clean-slate reset of TEST DATA. Run in the Supabase SQL editor.
-- NOT a schema migration — it's a manual data wipe (kept out of migrations/ on
-- purpose). ⚠ DESTRUCTIVE and irreversible: removes all teams, members, and
-- every member/workshop response.
--
-- KEEPS (untouched):
--   • consultants        — your dashboard logins
--   • ps_statements      — the canonical 12 items (reseeded by 0001)
--   • fish               — default fish patterns (table still referenced)
--   • all schema/tables  — structure is unchanged
--
-- Rationale: the pre-rebuild test data (duplicate same-email members, 3-point-
-- era rows) was the source of the login/profile confusion. Stage A is verified,
-- and later stages need a purpose-built multi-member team anyway. Fresh start.
--
-- After running: the consultant dashboard will show no teams. Create a new team
-- and add members to continue testing.
-- ============================================================================

begin;

truncate table
  public.ps_responses,
  public.ps_interview_responses,
  public.purpose_responses,
  public.coordination_ratings,
  public.ps_reflection_checks,
  public.feedback_responses,
  public.member_questions,
  public.missing_member_flags,
  public.fish_responses,
  public.analysis,
  public.code_of_conduct,
  public.followups,
  public.member_login_tokens,
  public.members,
  public.teams
  restart identity cascade;

commit;
