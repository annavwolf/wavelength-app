# Otis beta launch checklist

## Required deployment steps

1. Apply `supabase/migrations/0020_identity_expand.sql` if it has not already been applied. Verify that every member has a `member_identity` row.
2. Apply `supabase/migrations/0023_beta_privacy_and_retention.sql`, `supabase/migrations/0024_coordination_target_ids.sql`, `supabase/migrations/0025_lock_beta_data_with_rls.sql`, `supabase/migrations/0026_phase1_resume_checkpoint.sql`, `supabase/migrations/0027_early_access_entitlements.sql`, `supabase/migrations/0028_secure_interview_links.sql`, `supabase/migrations/0029_durable_audio_quota.sql`, and `supabase/migrations/0030_member_login_request_rate_limit.sql`, in that order. Use the current repository copy of `0024`: it uses `array_agg`, not the unsupported `min(uuid)` from an earlier draft.
3. Deploy this application version.
4. Set `beta_participation_ended_at` when a team's beta participation ends, then run `supabase/beta_retention_review.sql` as part of the monthly deletion review.
5. Configure and verify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `MEMBER_SESSION_SECRET`, `MEMBER_LOGIN_RATE_LIMIT_SECRET`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `RESEND_API_KEY`, a verified `RESEND_FROM_EMAIL` domain, and `EARLY_ACCESS_CODE_HASHES`. `SUPABASE_SERVICE_ROLE_KEY` is server-only and required after the RLS migration; a missing Resend configuration prevents actual invite and magic-link delivery. `MEMBER_LOGIN_RATE_LIMIT_SECRET` is a dedicated long HMAC secret for the durable magic-link limiter and safely falls back to `MEMBER_SESSION_SECRET` during transition. `EARLY_ACCESS_CODE_HASHES` must contain SHA-256 hashes only, never raw codes or a `NEXT_PUBLIC_*` value. Also set a distinct long `EARLY_ACCESS_PENDING_COOKIE_SECRET` if possible; the app safely falls back to `MEMBER_SESSION_SECRET` during transition.
6. If you are enabling enhanced audio, set server-only `ELEVENLABS_API_KEY` and `OTIS_ELEVENLABS_VOICE_ID` in Vercel. Use a stock voice, not a cloned voice. Do not set an audio key in any `NEXT_PUBLIC_*` variable. Set a conservative hard spend cap and billing alert in ElevenLabs, then add Vercel WAF rate-limit rules for `/api/audio/*`, `/api/early-access`, and `/api/early-access/pending` before exposing the app publicly.
7. Have the privacy owner complete the unresolved factual details listed in `Otis_Beta_Participant_Privacy_Notice_v0.4.md` before public beta. Deploying v0.4 deliberately requires existing participants to acknowledge the updated notice once.

## End-to-end acceptance check

1. A consultant signs up, creates a team, adds members, and opens the invite page.
2. Send an invite and verify that the email links to an opaque `/i/...` URL. Re-send a fresh secure invite to every active participant after deploying this version: legacy bare `/interview/<uuid>` links intentionally no longer grant access.
3. Open the participant URL in a clean browser. It should redirect to the member's interview without retaining the raw secret in the browser address bar. The first screen must be the beta privacy information; microphone controls and interview questions must not appear first.
4. Verify that the participant cannot continue until they choose both text-only/optional enhanced audio and a summary-only/exact-excerpt preference, then check the acknowledgement box.
5. Verify text-only selection hides microphone controls and does not call the hosted audio provider. If enhanced audio is selected, confirm microphone access is only requested after the participant presses a microphone control; confirm the editable transcript arrives before any answer is saved.
6. Complete the assessment. The consultant roster should show the participant's acknowledgement and completion status.
7. Run Tier 1/Tier 2 analysis. Confirm a participant without an acknowledgement is excluded, individual locations are not shown, and summary-only wording is not exposed in consultant-facing raw-response panels.
8. Sign in as a participant and change the exact-word preference. Re-run downstream analysis before issuing a new report.
9. Leave Phase 1 midway, return through the profile, then reopen it. Confirm the participant resumes on the exact saved screen rather than the privacy gate. Repeat the safe exit check for the Results & Team Agreement Activity and team results.
10. Enter the Results & Team Agreement Activity after a current Phase 1 acknowledgement. Confirm it does not request a second privacy acknowledgement; it may only ask to confirm the exact-word preference before relevant content.
11. Test stories, behaviours, and entire-contribution withdrawal before and after report generation. Confirm the two-step warning appears, whole-contribution withdrawal requires typing `WITHDRAW`, data is deleted where possible, and `member_withdrawals` contains an audit row.
12. Create a standard consultant account and confirm that team creation, invitations, assessments, and standard results work, while activity release, Team Agreement generation/release, and the workshop return an early-access lock. Redeem a valid code at `/early-access`, then confirm each gated action succeeds.
13. If enhanced audio is configured, test it on iOS Safari and Android Chrome: after explicit opt-in, microphone permission is requested only after tapping the mic, a short recording becomes an editable transcript, and raw audio is not saved. Confirm a text-only participant never calls the hosted audio routes.
14. In a clean browser, try a bare `/interview/<member UUID>` URL and an API request containing only another participant's UUID. Both must be rejected. While signed in as one participant, confirm the roster only displays names and never exposes teammates' IDs, profiles, answers, privacy settings, or audio access.
15. Request a member magic link four times from the same browser/address and confirm the fourth request is rate-limited without revealing whether the email belongs to a team. Confirm the same email is also limited after ten requests across different addresses, and that the response is `Cache-Control: no-store`.

## Operational note

Migration `0025_lock_beta_data_with_rls.sql` is a required part of this release. It removes the legacy direct-browser table-access model and enables RLS without public policies for all beta data tables. Do not deploy this code without applying that migration first: all active application data paths now use scoped server routes with the service-role client.

The application has a bounded per-instance rate limit for beta-code submission,
but Vercel serverless instances do not share that memory. Before public beta,
add a shared Vercel WAF/rate-limit rule for `POST /api/early-access/pending`
and `POST /api/early-access` (strict per-IP attempts over 15 minutes).

Migration `0030_member_login_request_rate_limit.sql` provides the durable
application limit for `POST /api/member/auth/request` across serverless
instances. It is not a replacement for a Vercel WAF rule: add an IP-level
backstop for that path before public beta.
