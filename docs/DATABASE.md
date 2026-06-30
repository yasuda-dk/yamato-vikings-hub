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

## Phase 2 Event And RSVP Slice

The first Phase 2 slice adds event listing, admin event creation, member RSVP, late-arrival reporting, and late-response tracking.

Tables:

- `seasons`
- `events`
- `attendance`
- `event_guests`

Controlled values:

- Event type: `Football`, `Tournament`, `Social`, `Other`
- Event status: `Draft`, `Open`, `Attendance confirmed`, `Teams confirmed`, `Voting open`, `Completed`, `Cancelled`
- RSVP status: `Going`, `Maybe`, `Not going`
- Actual status: `Not confirmed`, `Attended`, `Absent`

Server-side functions:

- `create_event`
- `list_events`
- `get_event_detail`
- `upsert_my_rsvp`
- `create_event_guest`
- `set_member_actual_status`
- `set_guest_actual_status`

Rules enforced in this slice:

- Only Admin profiles can create events.
- Approved devices can read events and their own/public RSVP counts.
- A linked Member can update only their own RSVP through `upsert_my_rsvp`.
- Late arrival is valid only when RSVP is `Going`.
- Expected arrival time requires late arrival.
- Changing RSVP away from `Going` clears late-arrival data.
- RSVP updates after the deadline are marked as late responses.
- Cancelled events reject RSVP changes.
- Event Guests are scoped to one event and do not create member profiles.
- Guest names are normalized and must be unique within the event.
- Guest names cannot duplicate a Member who already has an attendance row for the same event.
- Only Admin profiles can add Guests or confirm actual attendance.
- Actual attendance is stored separately from planned RSVP.

Rules for future phases:

- Enable RLS on every exposed application table.
- Enforce important business rules in database constraints, policies, or server-side functions.
- Keep historical records instead of permanently deleting operational data.
- Store only first names for members.
- Store normalized first names for uniqueness checks.
- Use controlled profile values for age group, gender, residence type, position, and football level.
- Never store plaintext team passwords.
