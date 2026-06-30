# Database

Phase 1 creates the access and member-profile foundation.

Schema changes must be implemented with migrations under `supabase/migrations`.

## Phase 1 Tables

- `teams`
- `team_settings`
- `device_access`
- `members`
- `member_device_links`
- `member_public_history`
- `audit_log`

## Phase 1 Functions

- `normalize_first_name`
- `has_current_device_access`
- `current_member_id`
- `is_admin`
- `verify_team_password`
- `select_member_profile`
- `register_member_profile`
- `update_own_member_profile`
- `reset_device_access`
- `change_team_password`
- `initialize_team_password`

The initial team password is configured through the setup Edge Function and stored only as a salted hash.

Rules for future phases:

- Enable RLS on every exposed application table.
- Enforce important business rules in database constraints, policies, or server-side functions.
- Keep historical records instead of permanently deleting operational data.
- Store only first names for members.
- Store normalized first names for uniqueness checks.
- Use controlled profile values for age group, gender, residence type, position, and football level.
- Never store plaintext team passwords.
