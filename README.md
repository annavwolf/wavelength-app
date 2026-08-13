# Wavelength

Wavelength is an AI organisational psychologist for teamwork and psychological
safety. A
consultant sets up a team and invites its members via a private, revocable link; each
member then walks through a guided, conversational interview (built around
psychological safety and team dynamics) without needing an account of their
own. Responses are collected in Supabase and used to build a team-facing
report.

Built with [Next.js](https://nextjs.org) (App Router) and
[Supabase](https://supabase.com) (Postgres + Auth).

## Getting started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy these into a `.env.local` file in the project root (never commit this
file — it's already covered by `.gitignore`):

| Variable                       | Description                                                    |
| ------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL (Project Settings → API).             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/publishable key (Project Settings → API).    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only Supabase key used by authenticated application routes. |
| `NEXT_PUBLIC_APP_URL`           | Canonical deployed URL, for example `https://app.example.com`.  |
| `MEMBER_SESSION_SECRET`         | Long random server-only secret used to sign member and scoped interview sessions. |
| `ANTHROPIC_API_KEY`             | Anthropic API key, used for Wavelength's AI-driven analysis.    |
| `VOYAGE_API_KEY`                | Voyage key used for embeddings, when analysis uses embeddings.  |
| `RESEND_API_KEY`                | Resend API key used for invitations and member magic links.     |
| `RESEND_FROM_EMAIL`             | A verified sender, e.g. `Otis <otis@wavelength.team>`.          |
| `MEMBER_LOGIN_RATE_LIMIT_SECRET` | Recommended dedicated server-only HMAC secret for durable member magic-link request limits; falls back to `MEMBER_SESSION_SECRET`. |
| `EARLY_ACCESS_CODE_HASHES`      | Server-only comma-separated SHA-256 hashes for beta early-access codes. |
| `EARLY_ACCESS_PENDING_COOKIE_SECRET` | Recommended dedicated server-only secret for short-lived sign-up early-access claims; falls back to `MEMBER_SESSION_SECRET` during transition. |
| `DEEPGRAM_API_KEY`              | Server-only Deepgram API key for optional enhanced audio.       |
| `OTIS_DEEPGRAM_TTS_MODEL`       | Optional; defaults to `aura-2-arcas-en`.                        |
| `OTIS_DEEPGRAM_STT_MODEL`       | Optional; defaults to `nova-3`.                                 |
| `OTIS_AUDIO_TTS_REQUESTS_PER_MINUTE` | Optional bounded per-participant hosted-TTS quota; defaults to `20`. |
| `OTIS_AUDIO_TTS_CHARACTERS_PER_MINUTE` | Optional bounded TTS character quota; defaults to `20000`. |
| `OTIS_AUDIO_STT_REQUESTS_PER_MINUTE` | Optional bounded voice-to-text quota; defaults to `6`. |
| `OTIS_AUDIO_STT_DURATION_MS_PER_MINUTE` | Optional declared-recording-duration quota; defaults to `120000`. |
| `OTIS_AUDIO_STT_BYTES_PER_MINUTE` | Optional trusted byte quota; defaults to `1048576` (1 MiB). |
| `OTIS_AUDIO_PILOT_TTS_CHARACTERS_PER_MONTH` | Optional shared pilot TTS cap; defaults to `1000000`. |
| `OTIS_AUDIO_PILOT_STT_DURATION_MS_PER_MONTH` | Optional shared pilot STT cap; defaults to `30000000` (500 minutes). |
| `OTIS_AUDIO_PILOT_STT_BYTES_PER_MONTH` | Optional shared pilot STT byte cap; defaults to `536870912` (512 MiB). |

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
MEMBER_SESSION_SECRET=a-long-random-secret
ANTHROPIC_API_KEY=your-anthropic-api-key
VOYAGE_API_KEY=your-voyage-api-key
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL="Otis <otis@your-verified-domain.com>"
MEMBER_LOGIN_RATE_LIMIT_SECRET=a-separate-long-random-secret
EARLY_ACCESS_CODE_HASHES=sha256-hash-of-your-long-code
EARLY_ACCESS_PENDING_COOKIE_SECRET=a-separate-long-random-secret
DEEPGRAM_API_KEY=your-deepgram-api-key
OTIS_DEEPGRAM_TTS_MODEL=aura-2-arcas-en
OTIS_DEEPGRAM_STT_MODEL=nova-3
```

`NEXT_PUBLIC_*` variables are inlined into the client bundle at **build
time**, so when deploying, make sure they're set before the first build runs
(or trigger a redeploy after adding/changing them).

### Member magic-link protection

`POST /api/member/auth/request` has a durable Supabase-backed limit of **3
requests per 15 minutes** for one email/address combination and **10 per hour**
per email. The database records only HMAC-SHA-256 rate-limit keys and short-lived
counters, never raw email addresses or IP addresses; `0030_member_login_request_rate_limit.sql`
deletes counters older than two hours. Set a dedicated, long
`MEMBER_LOGIN_RATE_LIMIT_SECRET` in Vercel (or the app uses the existing
`MEMBER_SESSION_SECRET` during transition). Keep a Vercel WAF/IP rule in front
of this route as a network-level backstop.

### Beta early access

Standard consultant accounts can create teams, invite participants, collect
assessments, and view the standard analysis. Releasing the Results & Team
Agreement Activity, generating/releasing the Team Agreement, and using the
facilitated workshop require early access.

Create a long, unique code in a password manager, then set its SHA-256 hash in
the server-only `EARLY_ACCESS_CODE_HASHES` variable (multiple comma-separated
hashes are supported):

```bash
node -e "console.log(require('crypto').createHash('sha256').update('replace-with-a-long-unique-code').digest('hex'))"
```

Never put the raw code in a `NEXT_PUBLIC_*` variable, the repository, a URL,
or browser storage. Consultants can redeem it at `/early-access`; new
consultants can optionally enter it during account creation. Before the account
is created, the server validates the code and stores only its SHA-256 hash in a
signed, HttpOnly cookie for 30 minutes. The confirmation callback consumes it
after Supabase authenticates the consultant, so the email confirmation can be
opened in a different browser tab. If that short-lived claim expires or the
database is temporarily unavailable, `/early-access` remains the manual-entry
fallback. To grant access manually,
set `early_access_granted_at` and `early_access_grant_source = 'manual'` on
their `public.consultants` row.

The app also applies a small bounded per-instance attempt limit to early-access
code checks. Before public beta, add a shared Vercel WAF/rate-limit rule for
`POST /api/early-access/pending` and `POST /api/early-access` (for example, a
strict per-IP limit over a 15-minute window). Serverless instances do not share
in-memory counters, so this operational control remains important.

### Optional enhanced audio

Otis works fully with typed responses and the browser's read-aloud fallback.
To enable the optional hosted voice experience, create a Deepgram project API
key and, where the console offers permission choices, limit it to the speech-
to-text and text-to-speech features Otis needs. Add `DEEPGRAM_API_KEY` as a
server-only Vercel environment variable. `OTIS_DEEPGRAM_TTS_MODEL` and
`OTIS_DEEPGRAM_STT_MODEL` are optional server-only overrides. Do not expose any
of these with a `NEXT_PUBLIC_*` name, place a key in source control, or paste a
key into a browser console.

Before adding the key to Vercel, open the Deepgram project's billing settings
and turn **Auto-Load** off. Keep it off during the pilot, review the project's
usage and remaining credit regularly, and do not rely on free credit as a
spending control.

With the variables set, a participant who has explicitly selected enhanced
audio can tap the microphone to record a short answer, stop recording, and
receive an editable transcript. Otis proxies the clip to Deepgram in memory
only; it does not save raw recordings. Participants who choose text-only never
call the hosted audio routes. The in-app notice is version `beta-0.5`, so a
fresh acknowledgement is required before the enhanced provider can be used.

The app also uses a durable per-participant minute quota
(`0029_durable_audio_quota.sql`) and a shared monthly pilot cap
(`0031_pilot_audio_quota.sql`). The default shared cap is 1,000,000 spoken
characters and 500 minutes / 512 MiB of submitted speech each UTC month. That
is intentionally enough for a 50-person pilot, but it is not a replacement for
provider billing controls against a large number of new accounts. Add a Vercel
WAF rate-limit rule for `/api/audio/*`, `/api/early-access`, and
`/api/early-access/pending` as a production backstop.

## Routes

- `/login` — consultant sign in / sign up (public)
- `/` — consultant dashboard
- `/teams/new`, `/teams/[team_id]/members`, `/teams/[team_id]/fish`,
  `/teams/[team_id]/invite` — team setup flow (requires a signed-in
  consultant)
- `/i/[token]` — secure invite entry point; trades the opaque, revocable link
  for a scoped browser interview session, then redirects to the interview
- `/interview/[member_id]` — the member interview. It never accepts a bare
  member ID as access; it requires the scoped invite session or the member's
  own signed-in session.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint the project

## Deployment

This app deploys cleanly to [Vercel](https://vercel.com). Set every required
environment variable above in the Vercel project's dashboard before deploying,
then add the deployed URL to Supabase Auth's allowed redirect URLs. Apply the
SQL migrations in [BETA_LAUNCH_CHECKLIST.md](./BETA_LAUNCH_CHECKLIST.md) before
using the deployed beta.
