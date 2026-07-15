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

Deploy or update the scheduled reminder Edge Function separately because GitHub Actions calls it without a Supabase user JWT. It is protected by `PAYMENT_REMINDER_JOB_TOKEN` instead:

```bash
npm run deploy:reminder-function
```

Set or rotate the private setup token:

```bash
npx supabase secrets set TEAM_SETUP_TOKEN='generated-token' --project-ref fejfeysavvwendbjqywa
```

Set the initial team password from the local machine:

```bash
TEAM_PASSWORD='choose-a-real-team-password' npm run setup:team-password
```

## Practice payment notifications

Practice payment reminders use Web Push. Members enable reminders from the Home screen, and only that device's push subscription is stored.

Required Supabase Edge Function secrets:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
PAYMENT_REMINDER_JOB_TOKEN
```

Required GitHub Actions repository secrets:

```text
PAYMENT_REMINDER_URL
PAYMENT_REMINDER_TOKEN
```

`PAYMENT_REMINDER_URL` points to the `send-practice-payment-reminders` Edge Function URL. `PAYMENT_REMINDER_TOKEN` must match `PAYMENT_REMINDER_JOB_TOKEN`.

The GitHub Actions workflow runs hourly. The Edge Function sends reminders only when the current Europe/Copenhagen time is Friday 20:00. It targets Practice payments for the previous day, so the normal Thursday Practice reminder is sent Friday at 20:00.
