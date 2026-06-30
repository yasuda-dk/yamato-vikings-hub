# Deployment

GitHub Pages deployment is configured through `.github/workflows/deploy-pages.yml`.

Production deployment should run from `main` only. Pull requests run checks but do not deploy.

## Required GitHub settings

- Enable GitHub Pages deployment from GitHub Actions.
- Protect `main`.
- Require CI checks before merge.
- Disable force push.
- Prefer squash merge.

## Build

The deploy workflow runs:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

`GITHUB_PAGES=true` sets the Vite base path to `/yamato-vikings-hub/`.

## Supabase Phase 1

Apply migrations:

```bash
npx supabase db push --linked
```

Deploy Edge Functions:

```bash
npx supabase functions deploy setup-team-password --project-ref fejfeysavvwendbjqywa --no-verify-jwt --use-api
npx supabase functions deploy verify-team-password register-member select-profile session-state --project-ref fejfeysavvwendbjqywa --use-api
```

Set or rotate the private setup token:

```bash
npx supabase secrets set TEAM_SETUP_TOKEN='generated-token' --project-ref fejfeysavvwendbjqywa
```

Set the initial team password from the local machine:

```bash
TEAM_PASSWORD='choose-a-real-team-password' npm run setup:team-password
```
