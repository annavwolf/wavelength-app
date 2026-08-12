# Otis beta launch checklist

## Required deployment steps

1. Apply `supabase/migrations/0020_identity_expand.sql` if it has not already been applied. Verify that every member has a `member_identity` row.
2. Apply `supabase/migrations/0023_beta_privacy_and_retention.sql`, `supabase/migrations/0024_coordination_target_ids.sql`, `supabase/migrations/0025_lock_beta_data_with_rls.sql`, and `supabase/migrations/0026_phase1_resume_checkpoint.sql`, in that order. Use the current repository copy of `0024`: it uses `array_agg`, not the unsupported `min(uuid)` from an earlier draft.
3. Deploy this application version.
4. Set `beta_participation_ended_at` when a team's beta participation ends, then run `supabase/beta_retention_review.sql` as part of the monthly deletion review.
5. Configure and verify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `MEMBER_SESSION_SECRET`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `RESEND_API_KEY`, and a verified `RESEND_FROM_EMAIL` domain. `SUPABASE_SERVICE_ROLE_KEY` is server-only and required after the RLS migration; a missing Resend configuration prevents actual invite and magic-link delivery.
6. Have the privacy owner complete the unresolved factual details listed in `Otis_Beta_Participant_Privacy_Notice_v0.3.md` before public beta.

## End-to-end acceptance check

1. A consultant signs up, creates a team, adds members, and opens the invite page.
2. Send an invite and verify that the email links to the intended unique participant URL.
3. Open the participant URL in a clean browser. The first screen must be the beta privacy information; microphone controls and interview questions must not appear first.
4. Verify that the participant cannot continue until they choose both text-only/voice input and a summary-only/exact-excerpt preference, then check the acknowledgement box.
5. Verify text-only selection hides microphone controls. If voice input is selected, confirm microphone access is only requested after the participant presses a microphone control.
6. Complete the assessment. The consultant roster should show the participant's acknowledgement and completion status.
7. Run Tier 1/Tier 2 analysis. Confirm a participant without an acknowledgement is excluded, individual locations are not shown, and summary-only wording is not exposed in consultant-facing raw-response panels.
8. Sign in as a participant and change the exact-word preference. Re-run downstream analysis before issuing a new report.
9. Leave Phase 1 midway, return through the profile, then reopen it. Confirm the participant resumes on the exact saved screen rather than the privacy gate. Repeat the safe exit check for the Results & Team Agreement Activity and team results.
10. Enter the Results & Team Agreement Activity after a current Phase 1 acknowledgement. Confirm it does not request a second privacy acknowledgement; it may only ask to confirm the exact-word preference before relevant content.
11. Test stories, behaviours, and entire-contribution withdrawal before and after report generation. Confirm the two-step warning appears, whole-contribution withdrawal requires typing `WITHDRAW`, data is deleted where possible, and `member_withdrawals` contains an audit row.

## Operational note

Migration `0025_lock_beta_data_with_rls.sql` is a required part of this release. It removes the legacy direct-browser table-access model and enables RLS without public policies for all beta data tables. Do not deploy this code without applying that migration first: all active application data paths now use scoped server routes with the service-role client.
