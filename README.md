# Wavelength

Wavelength is an AI organisational psychologist for virtual teams. A
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
| `ANTHROPIC_API_KEY`             | Anthropic API key, used for Wavelength's AI-driven analysis.    |

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

`NEXT_PUBLIC_*` variables are inlined into the client bundle at **build
time**, so when deploying, make sure they're set before the first build runs
(or trigger a redeploy after adding/changing them).

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

This app deploys cleanly to [Vercel](https://vercel.com). Set the three
environment variables above in the Vercel project's dashboard before
deploying.
