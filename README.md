# Wavelength

Wavelength is an AI organisational psychologist for teamwork and psychological
safety. A
consultant sets up a team and invites its members via a private link; each
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
| `MEMBER_SESSION_SECRET`         | Long random server-only secret used to sign member sessions.    |
| `ANTHROPIC_API_KEY`             | Anthropic API key, used for Wavelength's AI-driven analysis.    |
| `VOYAGE_API_KEY`                | Voyage key used for embeddings, when analysis uses embeddings.  |
| `RESEND_API_KEY`                | Resend API key used for invitations and member magic links.     |
| `RESEND_FROM_EMAIL`             | A verified sender, e.g. `Otis <otis@wavelength.team>`.          |
| `EARLY_ACCESS_CODE_HASHES`      | Server-only comma-separated SHA-256 hashes for beta early-access codes. |

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
EARLY_ACCESS_CODE_HASHES=sha256-hash-of-your-long-code
```

`NEXT_PUBLIC_*` variables are inlined into the client bundle at **build
time**, so when deploying, make sure they're set before the first build runs
(or trigger a redeploy after adding/changing them).

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

Never put the raw code in a `NEXT_PUBLIC_*` variable, the repository, or a URL.
Consultants can redeem it at `/early-access`; new consultants can optionally
enter it during account creation, and it will be applied after email
verification when they continue in the same browser. To grant access manually,
set `early_access_granted_at` and `early_access_grant_source = 'manual'` on
their `public.consultants` row.

## Routes

- `/login` — consultant sign in / sign up (public)
- `/` — consultant dashboard
- `/teams/new`, `/teams/[team_id]/members`, `/teams/[team_id]/fish`,
  `/teams/[team_id]/invite` — team setup flow (requires a signed-in
  consultant)
- `/interview/[member_id]` — the member interview (public, no account
  required — accessed via a private per-member link)

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
