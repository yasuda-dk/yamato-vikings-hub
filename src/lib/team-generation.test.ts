import { describe, expect, it } from 'vitest';
import { generateTeams, scoreTeams, type TeamGenerationParticipant } from './team-generation';
import type { AgeGroup, FootballLevel, Position } from './member-options';

function participant(
  index: number,
  overrides: Partial<TeamGenerationParticipant> = {},
): TeamGenerationParticipant {
  const positions: Position[] = ['FW', 'MF', 'DF'];
  const ageGroups: AgeGroup[] = ['Under 25', '25–29', '30–34', '35–39', '40–49', '50+'];
  return {
    kind: 'member',
    id: `member-${index}`,
    first_name: `Player ${index}`,
    football_level: ((index % 5) + 1) as FootballLevel,
    primary_position: positions[index % positions.length],
    secondary_position: positions[(index + 1) % positions.length],
    age_group: ageGroups[index % ageGroups.length],
    actual_status: 'Attended',
    membership_status: 'Active',
    ...overrides,
  };
}

function participants(count: number, overrides: (index: number) => Partial<TeamGenerationParticipant> = () => ({})) {
  return Array.from({ length: count }, (_, index) => participant(index + 1, overrides(index + 1)));
}

function expectValidDistribution(result: ReturnType<typeof generateTeams>, teamCount: number, expectedCount: number) {
  const assigned = result.teams.flatMap((team) => team.participants);
  const assignedKeys = assigned.map((item) => `${item.kind}:${item.id}`);
  const sizes = result.teams.map((team) => team.participants.length);

  expect(result.teams).toHaveLength(teamCount);
  expect(assigned).toHaveLength(expectedCount);
  expect(new Set(assignedKeys).size).toBe(assignedKeys.length);
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
}

describe('team generation', () => {
  it('splits 6 participants into 2 balanced teams', () => {
    const result = generateTeams({ participants: participants(6), teamCount: 2, seed: 'event-1:1' });
    expectValidDistribution(result, 2, 6);
  });

  it('splits 12 participants into 2 balanced teams', () => {
    const result = generateTeams({ participants: participants(12), teamCount: 2, seed: 'event-2:1' });
    expectValidDistribution(result, 2, 12);
  });

  it('splits 17 participants into 2 balanced teams', () => {
    const result = generateTeams({ participants: participants(17), teamCount: 2, seed: 'event-17:2' });
    expectValidDistribution(result, 2, 17);
  });

  it('splits 17 participants into 3 balanced teams', () => {
    const result = generateTeams({ participants: participants(17), teamCount: 3, seed: 'event-17:3' });
    expectValidDistribution(result, 3, 17);
  });

  it('splits 17 participants into 4 balanced teams', () => {
    const result = generateTeams({ participants: participants(17), teamCount: 4, seed: 'event-17:4' });
    expectValidDistribution(result, 4, 17);
  });

  it('supports member and guest combinations', () => {
    const mixedParticipants = participants(10, (index) => (index > 7 ? { kind: 'guest', id: `guest-${index}` } : {}));
    const result = generateTeams({ participants: mixedParticipants, teamCount: 2, seed: 'guests' });
    expectValidDistribution(result, 2, 10);
    expect(result.teams.flatMap((team) => team.participants).some((item) => item.kind === 'guest')).toBe(true);
  });

  it('handles uneven and all-FW position distributions', () => {
    const uneven = participants(11, (index) => ({ primary_position: index <= 8 ? 'FW' : 'DF', secondary_position: null }));
    const result = generateTeams({ participants: uneven, teamCount: 3, seed: 'positions' });
    expectValidDistribution(result, 3, 11);
  });

  it('handles large football-level imbalance', () => {
    const imbalanced = participants(12, (index) => ({ football_level: (index <= 4 ? 5 : 1) as FootballLevel }));
    const result = generateTeams({ participants: imbalanced, teamCount: 3, seed: 'levels' });
    expectValidDistribution(result, 3, 12);
    const totals = result.teams.map((team) => team.summary.totalFootballLevel);
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(4);
  });

  it('excludes absent and inactive members', () => {
    const source = [
      ...participants(8),
      participant(99, { actual_status: 'Absent' }),
      participant(100, { membership_status: 'Inactive' }),
    ];
    const result = generateTeams({ participants: source, teamCount: 2, seed: 'eligibility' });
    expectValidDistribution(result, 2, 8);
    expect(result.eligibleParticipants.some((item) => item.id === 'member-99' || item.id === 'member-100')).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    const source = participants(12);
    const first = generateTeams({ participants: source, teamCount: 2, seed: 'same-seed' });
    const second = generateTeams({ participants: source, teamCount: 2, seed: 'same-seed' });
    expect(first.teams.map((team) => team.participants.map((item) => item.id))).toEqual(second.teams.map((team) => team.participants.map((item) => item.id)));
  });

  it('can produce a different valid result for a different seed', () => {
    const source = participants(17);
    const first = generateTeams({ participants: source, teamCount: 3, seed: 'seed-a', attempts: 1 });
    const second = generateTeams({ participants: source, teamCount: 3, seed: 'seed-b', attempts: 1 });
    expectValidDistribution(first, 3, 17);
    expectValidDistribution(second, 3, 17);
    expect(first.teams.map((team) => team.participants.map((item) => item.id))).not.toEqual(second.teams.map((team) => team.participants.map((item) => item.id)));
  });

  it('keeps locked players fixed', () => {
    const result = generateTeams({
      participants: participants(12),
      teamCount: 3,
      seed: 'locks',
      lockedAssignments: {
        'member:member-1': 0,
        'member:member-2': 1,
      },
    });
    expect(result.teams[0].participants.some((item) => item.id === 'member-1')).toBe(true);
    expect(result.teams[1].participants.some((item) => item.id === 'member-2')).toBe(true);
    expectValidDistribution(result, 3, 12);
  });

  it('recalculates score after a manual swap', () => {
    const result = generateTeams({ participants: participants(12), teamCount: 2, seed: 'swap-score' });
    const swappedTeams = result.teams.map((team) => ({ ...team, participants: [...team.participants] }));
    [swappedTeams[0].participants[0], swappedTeams[1].participants[0]] = [swappedTeams[1].participants[0], swappedTeams[0].participants[0]];

    expect(scoreTeams(swappedTeams).score).toBeTypeOf('number');
  });
});
