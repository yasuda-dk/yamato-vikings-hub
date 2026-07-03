# Yamato Vikings Hub

Mobile-only PWA for managing Yamato Vikings football activities.

This repository currently implements Phase 0: project foundation, mobile shell, routing, PWA assets, Supabase configuration placeholders, automated checks, and documentation.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router with `HashRouter`
- Supabase
- Vitest and React Testing Library
- Playwright mobile smoke tests

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Update `.env.local` with the local or hosted Supabase publishable values.

Never place Supabase service-role keys, admin passwords, plaintext team passwords, or production data in this repository.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## GitHub Pages

The production build uses the `/yamato-vikings-hub/` base path when `GITHUB_PAGES=true`.

Deployment is configured in `.github/workflows/deploy-pages.yml` and should run from `main` only.

## Supabase

Local Supabase configuration is in `supabase/config.toml`.

Phase 1 adds the access/profile schema and Edge Functions.

Deploy current Supabase migrations and Edge Functions from a logged-in Supabase CLI:

```bash
npx supabase db push --linked
npm run deploy:functions
npm run deploy:setup-function
```

After deploying the migration and functions, set the first shared team password locally without committing it:

```bash
TEAM_PASSWORD='choose-a-real-team-password' npm run setup:team-password
```

The plaintext password is sent only to the setup Edge Function and stored as a salted hash.
