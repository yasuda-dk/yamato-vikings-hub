# Security

Security posture:

- The browser may use only Supabase publishable configuration.
- No Supabase service-role key belongs in frontend code.
- No plaintext team password belongs in code, database fixtures, logs, or browser storage.
- No production data belongs in the repository.

Required future controls:

- Team-password verification through an Edge Function.
- Device access grants versioned by `access_version`.
- Admin authentication through Supabase Auth email and password.
- RLS on all exposed application tables.
- Server-side enforcement for protected member fields, attendance, team generation, voting, fines, and payments.

## Phase 1 Setup

The first shared team password is set with:

```bash
TEAM_PASSWORD='choose-a-real-team-password' npm run setup:team-password
```

This command reads `TEAM_SETUP_TOKEN` from ignored `.env.setup.local`, calls the setup Edge Function, and stores only a salted hash in `team_settings.team_password_hash`.

Do not paste the real team password into chat, commit it, or store it in frontend code.

The `setup-team-password` function is protected by `TEAM_SETUP_TOKEN` and can initialize the password only once. Later password changes must go through authenticated Admin flows.
