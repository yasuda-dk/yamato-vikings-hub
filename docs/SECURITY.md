# Security

Phase 0 security posture:

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
