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
- `update_event`
- `duplicate_event`
- `list_events`
- `get_event_detail`
- `upsert_my_rsvp`
- `create_event_guest`
- `set_member_actual_status`
- `set_guest_actual_status`

Rules enforced in this slice:

- Only Admin profiles can create events.
- Only Admin profiles can edit events.
- Event duplication copies the operational event configuration but requires a new date.
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

## Phase 5 Fine Box Foundation

The first Fine Box slice adds reusable fine records and member payment reporting.

Tables:

- `fine_types`
- `fines`

Controlled values:

- Payment status: `Unpaid`, `Payment reported`, `Paid`, `Waived`

Server-side functions:

- `list_fine_box`
- `report_fine_payment`
- `create_fine`
- `create_fines`
- `update_fine_status`
- `create_fine_type`
- `update_fine_type`

Rules enforced in this slice:

- Approved devices can read public Fine Box rows through `list_fine_box`.
- Private Admin notes are not returned by `list_fine_box`.
- Fine detail views use only public fields returned by `list_fine_box`, including participant name, reason, amount, status, related event, and public payment timestamps.
- Fine history status filters are frontend-only and use the public `payment_status` values returned by `list_fine_box`.
- Members can report only their own unpaid member fines as paid.
- Event Guest fines cannot be reported by regular members.
- Reporting payment changes status from `Unpaid` to `Payment reported`.
- Active fine types are returned to approved users for selection.
- Inactive fine types are returned only to Admins for management.
- Admins can create reusable fine types with default DKK amounts.
- Admins can activate and deactivate fine types.
- Inactive fine types cannot be used for new fines.
- Admins can create member and event Guest fines.
- Admins can create the same fine for up to 50 selected participants in one batch.
- Batch fine creation rejects duplicate participant selections.
- Admins can confirm `Payment reported` fines as `Paid`.
- Admins can waive `Unpaid` or `Payment reported` fines.
- MobilePay box number and URL are read from `team_settings`.

## Phase 6 Analytics Overview And CSV Export

The initial analytics and CSV export slices are frontend-only and do not add database tables or functions.

Sources:

- `members` from session state
- `list_events`
- `list_fine_box`

Initial Admin-only metrics:

- Active Member count
- Inactive Member count
- Average active Member football level
- Active Members by age group
- Active Members by residence type
- Active Members by primary position
- Active Members by gender
- Open event count
- Completed event count
- Going response count
- Late-arrival count
- Unpaid fine total

Admin CSV export:

- Available only from the Admin-only Season overview.
- Exports one CSV file with member, event, and fine rows.
- Uses only fields already returned through session state, `list_events`, and `list_fine_box`.
- Does not include internal UUIDs, anonymous Auth IDs, Admin emails, device links, private notes, security logs, or audit metadata.

Rules:

- The overview uses existing public fields and approved Edge Function/RPC responses.
- Season switching and deeper breakdowns remain out of scope for this slice.
