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
-- Robust to schema drift: some tables in the app's types (e.g.
-- ps_reflection_checks) were never actually created in the live DB, so we
-- truncate each table ONLY if it exists rather than failing the whole run.
--
-- After running: the consultant dashboard will show no teams. Create a new team
-- and add members to continue testing.
-- ============================================================================

do $$
declare
  t text;
  tbls text[] := array[
    'ps_responses',
    'ps_interview_responses',
    'purpose_responses',
    'coordination_ratings',
    'ps_reflection_checks',
    'feedback_responses',
    'member_questions',
    'missing_member_flags',
    'fish_responses',
    'analysis',
    'code_of_conduct',
    'followups',
    'member_login_tokens',
    'members',
    'teams'
  ];
begin
  foreach t in array tbls loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('truncate table public.%I restart identity cascade', t);
      raise notice 'truncated %', t;
    else
      raise notice 'skipped (does not exist): %', t;
    end if;
  end loop;
end $$;
