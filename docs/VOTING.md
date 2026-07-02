# Voting

Phase 4 starts with event-specific MVP and Worst Player voting.

## Rules

- Voting is available only when an event has voting enabled.
- Admins open voting by moving the event to `Voting open`.
- Admins close voting by moving the event to `Completed`.
- Only active Members who attended the event can vote.
- Event Guests cannot vote.
- Candidates are attended Members and attended event Guests.
- Members cannot vote for themselves.
- Each voter can submit one MVP vote and one Worst Player vote.
- Voters can change votes while voting is open.
- Intermediate results are hidden while voting is open.
- Final winner totals are public after voting closes.
- Ties create multiple winners.
- Admins may override a completed award result.
- Admin overrides do not edit individual votes.
- Original calculated award rows remain stored; the current public result prefers the override row for that award type.

## Server Enforcement

The browser calls Edge Functions:

- `event-voting`
- `submit-vote`
- `set-voting-status`
- `override-award`

The Edge Functions call PostgreSQL RPCs:

- `get_event_voting`
- `submit_event_vote`
- `set_event_voting_status`
- `override_event_award`

The database enforces voter eligibility, candidate eligibility, self-vote blocking, one vote per type, hidden intermediate results, final tie calculation, and Admin-only award overrides.

## Tables

- `votes` stores individual voting choices.
- `event_awards` stores final calculated winners after voting closes and Admin override rows when corrections are made.

RLS is enabled on both tables. Direct public reads of individual votes are not allowed.
