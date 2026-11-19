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

## On-Demand Loading

The authenticated Home, Events, Event Detail, Fines, and Members screens use React lazy imports. Home's module starts loading alongside session validation when opening the root route; other screens remain on demand. The header and bottom navigation stay mounted during screen loading. A failed screen load offers a reload action that preserves the current hash URL and existing device session. Demo API and team-generation fixtures are dynamically imported only in demo builds.

Home's admin Season overview mounts when it comes within 200px of the viewport, deferring its analytics and fines requests until then. Browsers without IntersectionObserver load it immediately. Payment tracking, member permissions, and RSVP behavior are unchanged. Loaded screen modules are reused for subsequent navigation; live API data is still refreshed by each screen as before.

Home first requests `practice-payment-state` with `section: current`, which calls the history-free `get_practice_payment_state(uuid, boolean)` overload. Authorized tracking profiles load `section: history` only when the history panel approaches the viewport. History has independent loading, empty, error, and retry states, including when no current Practice exists. No payment data is cached in local storage. Deploy the `split_practice_payment_history` migration and updated `practice-payment-state` Edge Function before the frontend. Requests without a section retain the legacy full response so already-open clients keep working.

## Supabase

Apply migrations:

```bash
npx supabase db push --linked
```

Deploy regular authenticated Edge Functions:

```bash
npm run deploy:functions
```

Deploy or update the one setup-only Edge Function separately because it intentionally disables JWT verification:

```bash
npm run deploy:setup-function
```

Set or rotate the private setup token:

```bash
npx supabase secrets set TEAM_SETUP_TOKEN='generated-token' --project-ref fejfeysavvwendbjqywa
```

Set the initial team password from the local machine:

```bash
TEAM_PASSWORD='choose-a-real-team-password' npm run setup:team-password
```
