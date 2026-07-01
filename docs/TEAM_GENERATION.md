# Team Generation

Phase 3 starts with a pure TypeScript team-generation algorithm in `src/lib/team-generation.ts`.

## Inputs

The generator accepts:

- Attended Members
- Attended event Guests
- Team count: `2`, `3`, or `4`
- Seed string, normally `event_id + generation_attempt_number`
- Optional locked assignments keyed by participant kind and id

Participants are excluded when:

- `actual_status` is not `Attended`
- `membership_status` is `Inactive`

## Determinism

Generation uses a seeded pseudo-random function. The same input and seed produce the same teams. A different seed may produce a different valid team distribution.

## Algorithm

1. Filter to eligible participants.
2. Calculate target team sizes so sizes differ by no more than one.
3. Place locked participants into their requested teams.
4. Create multiple seeded candidate distributions.
5. Assign remaining participants greedily by best current score while respecting target sizes.
6. Improve each candidate with pair swaps between unlocked participants.
7. Return the lowest-scoring valid result.

## Scoring

Lower score is better.

- Team-size difference: hard penalty, highest priority.
- Football-level variance: highest balancing weight after size.
- Primary-position imbalance: medium weight.
- Secondary-position support: low weighted support.
- Age-group variance: lowest balancing weight.

The current score combines:

```text
size penalty
+ football-level variance * 120
+ primary-position imbalance * 35
- secondary-position support * 4
+ age variance * 5
```

Age group scores:

```text
Under 25      1
25-29         2
30-34         3
35-39         4
40-49         5
50+           6
Not specified 3.5
```

## Invariants

Automated tests cover:

- 6 participants into 2 teams
- 12 participants into 2 teams
- 17 participants into 2 teams
- 17 participants into 3 teams
- 17 participants into 4 teams
- Member and Guest combinations
- Uneven position distributions
- All-FW-heavy participant lists
- Large football-level imbalance
- No absent Member included
- No inactive Member included
- Every participant assigned exactly once
- Team sizes differ by at most one
- Same seed produces same teams
- Different seed can produce a different valid result
- Locked players remain fixed
- Manual swap score recalculation

## Manual Adjustment

The algorithm is intentionally independent from UI. Future Phase 3 UI work should use tap-based controls to:

- Move a participant
- Swap two participants
- Lock a participant to a team
- Remove a participant from draft teams
- Regenerate unlocked participants

Essential team adjustment must not rely on drag-and-drop.

## Draft Persistence

Draft team generation is saved server-side through Supabase Edge Functions and PostgreSQL RPCs.

- `generate-teams` loads eligible participants from the database, runs seeded generation, and saves a new draft.
- `get-event-teams` returns teams that the current approved device is allowed to read.
- `event_teams` stores the team name, display order, confirmation state, balance score, and score breakdown.
- `event_team_participants` stores exactly one Member or Event Guest per row.

Draft teams are Admin-only. Confirmed teams are readable by approved users. The save RPC deletes the previous unconfirmed draft for the event before inserting the new draft, and it validates that every submitted participant is either an attended active Member or an attended event Guest for that same event.

This slice does not yet include manual move, swap, lock, rename, or confirm controls. Those remain in the next Phase 3 tasks.
