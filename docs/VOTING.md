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

## Server Enforcement

The browser calls Edge Functions:

- `event-voting`
- `submit-vote`
- `set-voting-status`

The Edge Functions call PostgreSQL RPCs:

- `get_event_voting`
- `submit_event_vote`
- `set_event_voting_status`

The database enforces voter eligibility, candidate eligibility, self-vote blocking, one vote per type, hidden intermediate results, and final tie calculation.

## Tables

- `votes` stores individual voting choices.
- `event_awards` stores final calculated winners after voting closes.

RLS is enabled on both tables. Direct public reads of individual votes are not allowed.
