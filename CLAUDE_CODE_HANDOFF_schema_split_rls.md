# Claude Code Handoff — Schema Split + RLS for Otis Pilot Privacy

**Context you need before starting.** This work happens on the Otis Tool (Wavelength). Live app: `wavelength-app-five.vercel.app`. Repo: `github.com/annavwolf/wavelength-app`. Supabase project ID: `mthjdglspaazirrswsgz`. Stack: Next.js 14, TypeScript, Tailwind, Supabase, Vercel, Resend. Auth uses `MEMBER_SESSION_SECRET`.

You do not have direct DB access. All migrations are applied manually by Anna via the Supabase SQL editor. Your job is to produce the migration SQL, the code changes, and a verification checklist. Anna runs the SQL and confirms results back to you.

**No live data to worry about.** Keith's pilot has not started. Any test data currently in the database can be discarded. You may drop and recreate tables if that's cleaner than a migration.

---

## Why we're doing this

Two-word version: separate identity from responses.

Current state: participant email and survey responses live close enough together that anyone with Supabase read access — currently just Anna, but eventually a developer — can trivially link a person to their answers. The NDA with Keith and the participant privacy notice we're about to draft both promise pseudonymisation and access controls. Right now those promises aren't backed by the database structure.

End state: (1) email/identity in a `participants` table; (2) all response/answer data in tables keyed only by an internal session ID with no email column; (3) RLS on, with policies scoped by role; (4) two Supabase roles — `admin` (Anna, full access, logged) and `service` (the app, restricted); (5) an audit table logging every identity lookup.

---

## Constraints Anna needs preserved

1. Anna must retain the ability to look up a participant by email for support (password resets, tech help). This is a real product need. The design keeps this by giving her admin role access with an audit log, not by hiding it.
2. Every table you create needs `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` **removed** — RLS should be ON in the end state. (Standing pattern in this repo has been to disable RLS by default; that stops here for these tables.)
3. The consultant dashboard (Keith's view) must never touch the `participants` table directly. It reads from an aggregated/pseudonymised view only.
4. Manual migration workflow. Produce SQL Anna can paste into the Supabase SQL editor. Do not attempt to run migrations directly.

---

## Deliverable 1: Schema

Produce migration SQL that creates the following structure. Use the existing table names in the codebase as reference; the *shapes* below matter more than the exact names — align with what's already there.

### `participants` table
Holds identity. One row per person invited to a pilot.

- `id` (uuid, PK)
- `email` (text, unique, not null)
- `display_name` (text, nullable)
- `team_id` (uuid, FK to teams)
- `session_id` (uuid, unique, not null) — the opaque handle used everywhere else
- `created_at`, `updated_at`
- Any other identity-adjacent fields currently mixed into response tables

**RLS policies on `participants`:**
- `admin` role: full read/write
- `service` role: **insert only** (when a new participant is added via the app), and a very narrow read that returns only the row matching the current session's `session_id` (needed for the participant's own "welcome back" flow). No bulk read.
- No other role can select from this table.

### `responses` (and any related answer tables)
Holds all survey answers, free-text reflections, scores, section 2 virtuality data, etc.

- `session_id` (uuid, FK to participants.session_id) — the ONLY link to identity
- No `email`, no `name`, no direct FK to `participants.id`
- All existing response columns

**RLS policies on `responses`:**
- `service` role: read/write rows where `session_id` matches the current session
- `admin` role: full read
- Consultant dashboard reads via a view (see below), not directly

### `consultant_view_responses` (or similar — Postgres VIEW, not table)
A pseudonymised view the consultant dashboard queries. Selects from `responses` joined only on `session_id`, exposing a short opaque participant label (e.g. `P101`, `P102` — assigned in order of session creation within a team). Does NOT expose the session_id itself in the output. Does NOT touch `participants`.

Whatever the consultant sees — the dashboard queries this view exclusively.

### `identity_lookup_log` table
Audit trail for every time the identity link is used.

- `id` (uuid, PK)
- `looked_up_at` (timestamptz, default now())
- `admin_user_id` (uuid) — who did the lookup
- `participant_id` (uuid, FK to participants)
- `reason` (text) — free text ("password reset support", "tech issue triage", etc.)

Any code path that resolves a `session_id` → `email` or `participants` row via the admin role must write a row here in the same transaction. Provide a helper function `lookup_participant(session_id, reason)` that does the SELECT and the INSERT atomically. Admin queries should go through this helper, not raw SELECTs.

---

## Deliverable 2: Supabase roles

Anna's Supabase project currently uses the default `service_role` key server-side. Set up:

- Keep the existing `service_role` for app traffic, but scope its permissions per the RLS above. It should NOT be able to bulk-read `participants` or bypass RLS.
- Create an `admin` role for Anna's operational use. This is the role that can join across `participants` and `responses`. Access via a separate key or via Supabase dashboard login.

Document in the PR description how Anna switches between roles and where each key should live (env vars, local .env only, etc.).

---

## Deliverable 3: Code changes

Wherever the app currently:
- Writes email into a response table → stop doing that; write to `participants` instead
- Reads email alongside responses in a single query → split into two queries where the second (identity resolution) only runs with the admin role
- Displays email on the consultant dashboard → remove; the consultant view never shows email
- Uses the service key to touch `participants` beyond insert/self-read → refactor to use the admin path

Grep for `email` across the response-handling code paths, expect to touch multiple files.

---

## Deliverable 4: Verification checklist

At the end, provide Anna a short list of manual checks she can run in the Supabase SQL editor as the `service` role, e.g.:

- `SELECT * FROM participants;` → should return zero rows or only the current session's row, never the full list
- `SELECT email FROM responses;` → should error (column doesn't exist)
- `SELECT * FROM consultant_view_responses;` → should return pseudonymised data only
- A test insert into `identity_lookup_log` when the helper function is called

Anna will run these and confirm before Keith's pilot starts.

---

## Order of work

1. Write and share the migration SQL first, before any code changes. Anna reviews and runs it against the Supabase project.
2. Once Anna confirms schema is live and RLS policies are active, do the code changes in a single PR.
3. In the PR description, include: what env vars need updating in Vercel, the verification checklist above, and any rollback steps if something breaks the survey flow.

---

## What NOT to do

- Do not try to run migrations yourself. Produce SQL, hand it to Anna.
- Do not touch other unrelated tables in the same PR — keep this focused.
- Do not add "helpful" logging of participant content anywhere new. The audit log is for identity lookups only, not response content.
- Do not skip the view (`consultant_view_responses`) as "unnecessary abstraction". The view is a security boundary, not just tidiness.

---

## Open questions to raise with Anna before starting

If any of the following are unclear from the current codebase, ask before writing SQL:

1. What are the current table names for participants and responses? (align, don't duplicate)
2. Is there anywhere the app currently displays participant email to Keith (the consultant)? If yes, that path needs removing.
3. What's the current shape of the "welcome back" / session resume flow? The participants RLS policy needs to allow that flow to work.
