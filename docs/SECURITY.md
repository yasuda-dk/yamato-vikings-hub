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

## Phase 1 Admin Member Controls

- `update-member` requires the selected profile to be an active Admin.
- Regular Members cannot change protected fields such as first name, football level, member status, or role.
- Admin member updates are enforced in `admin_update_member`, not only in the UI.
- The final active Admin cannot remove their own Admin access accidentally.
- Admin member updates write private audit metadata and public member history without exposing Admin emails.

## Phase 2 Event And RSVP Controls

The event and RSVP slice keeps direct table writes closed to regular frontend code. The browser calls Edge Functions, and those functions execute database functions with the authenticated Supabase user context.

- `create-event` requires the selected profile to be an Admin.
- `update-event` and `duplicate-event` require the selected profile to be an Admin.
- `events-list` and `event-detail` require current approved device access.
- `update-rsvp` requires an active linked Member profile.
- RSVP updates are scoped to `current_member_id()`.
- Late-arrival and cancelled-event rules are enforced in the database function, not only in the UI.
- `create-event-guest` requires an Admin profile and keeps Guests event-specific.
- `update-attendance` and `update-guest-attendance` require an Admin profile.
- Actual attendance confirmation is separated from RSVP and remains server-enforced.
- Team generation, voting, and fines remain out of scope for this slice.

## Phase 5 Fine Box Controls

The Fine Box foundation keeps payment state changes behind Edge Functions and database functions.

- `fine-box` requires current approved device access and returns only public fine fields.
- Fine detail/history UI must not display private Admin notes, internal actor IDs, or security metadata.
- `report-fine-payment` requires a selected Member profile.
- `create-fine` and `update-fine-status` require an active Admin profile.
- `create-fines-batch` requires an active Admin profile and validates every selected participant server-side.
- `create-fine-type` and `update-fine-type` require an active Admin profile.
- A Member can report only their own `Unpaid` member fines.
- Event Guest fines are Admin-managed and cannot be reported by regular members.
- Regular members cannot create fines, confirm `Paid`, waive fines, edit fine amounts, or read private Admin notes.
- Regular members can see active fine type names through the public Fine Box result, but inactive fine types are Admin-only.
- New fines may reference only active fine types from the same team.
- Batch fine creation is capped at 50 selected participants and rejects duplicate selections.
- MobilePay details are loaded from `team_settings`; the frontend does not hard-code payment settings.

## Practice Payment Controls

Practice payment tracking is server-enforced through Edge Functions and database functions.

- `practice-payment-state` requires current approved device access and a selected Member profile.
- `mark-practice-payment-paid` requires current approved device access and an active selected Member profile.
- Only Members with RSVP `Going` for the target Practice can mark payment as paid.
- Members can mark only their own Practice payment as paid.
- Admin-only member editing controls `Default`, `Exempt`, and `Custom` Practice payment rules.
- Regular Members cannot change their own Practice payment rule or custom amount.
- Exempt Members cannot create Practice payment records.
- Custom Practice payment amounts must be above 0 DKK.
- Practice payments close after the day following the Practice date in the Europe/Copenhagen timezone.
- Admin payment totals and member-by-member tracking are returned only to selected Admin profiles.
- Regular Members receive only their own payment amount and status.
- Guest Practice payments are not exposed to regular users because Guests do not authenticate.
- The Home screen displays Genki's MobilePay number for manual payment, but no MobilePay deep link or automatic payment verification is implemented.

## Phase 6 Analytics Controls

- The first Season overview appears only for selected Admin profiles.
- The overview uses approved API responses and does not expose private Admin notes, actor IDs, device links, or security metadata.
- Season event analytics use `list_admin_season_events`, which requires current device access and Admin role.
- CSV export is available only from the Admin-only Season overview.
