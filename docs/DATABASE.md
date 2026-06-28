# Database

Phase 0 includes Supabase local configuration only.

Application schema starts in Phase 1 and must be implemented with migrations under `supabase/migrations`.

Rules for future phases:

- Enable RLS on every exposed application table.
- Enforce important business rules in database constraints, policies, or server-side functions.
- Keep historical records instead of permanently deleting operational data.
- Store only first names for members.
- Store normalized first names for uniqueness checks.
- Never store plaintext team passwords.
