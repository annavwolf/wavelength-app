-- Beta hardening: all application data now moves through authenticated server
-- routes using the service-role client. Lock public table access so the browser
-- Supabase key cannot read or write beta data directly.
--
-- The service-role client bypasses RLS; Supabase Auth itself uses the separate
-- auth schema and is unaffected. This deliberately removes old permissive
-- policies because the former browser-table access model is no longer used.

begin;

do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array[
    'analysis',
    'code_of_conduct',
    'consultants',
    'coordination_ratings',
    'feedback_responses',
    'fish',
    'fish_responses',
    'followups',
    'identity_lookup_log',
    'interview_labels',
    'member_behaviors',
    'member_identity',
    'member_login_tokens',
    'member_privacy_acknowledgements',
    'member_questions',
    'member_stories',
    'member_withdrawals',
    'members',
    'missing_member_flags',
    'pair_submissions',
    'phase3_context_responses',
    'phase3_conversation_messages',
    'phase3_pulse_checks',
    'ps_interview_responses',
    'ps_reflection_checks',
    'ps_responses',
    'ps_statements',
    'purpose_responses',
    'teams',
    'workshop_seed',
    'workshop_sessions',
    'workshop_votes'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('alter table public.%I enable row level security', target_table);

      for existing_policy in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = target_table
      loop
        execute format('drop policy if exists %I on public.%I', existing_policy.policyname, target_table);
      end loop;
    end if;
  end loop;
end
$$;

commit;
