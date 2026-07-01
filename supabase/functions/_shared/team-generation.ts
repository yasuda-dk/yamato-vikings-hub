export type Position = 'FW' | 'MF' | 'DF';
export type AgeGroup = 'Under 25' | '25–29' | '30–34' | '35–39' | '40–49' | '50+' | 'Not specified';

export type TeamGenerationParticipant = {
  kind: 'member' | 'guest';
  id: string;
  first_name: string;
  football_level: 1 | 2 | 3 | 4 | 5;
  primary_position: Position;
  secondary_position: Position | null;
  age_group: AgeGroup;
  actual_status: 'Not confirmed' | 'Attended' | 'Absent';
  membership_status?: 'Active' | 'Inactive';
};

export type GeneratedTeam = {
  name: string;
  participants: TeamGenerationParticipant[];
  summary: TeamSummary;
};

export type TeamSummary = {
  playerCount: number;
  totalFootballLevel: number;
  averageFootballLevel: number;
  positionCounts: Record<Position, number>;
  averageAgeScore: number;
};

export type ScoreBreakdown = {
  sizePenalty: number;
  levelVariance: number;
  primaryPositionImbalance: number;
  secondaryPositionSupport: number;
  ageVariance: number;
};

const teamNames = ['Team A', 'Team B', 'Team C', 'Team D'];
const positions: Position[] = ['FW', 'MF', 'DF'];
const ageScores: Record<AgeGroup, number> = {
  'Under 25': 1,
  '25–29': 2,
  '30–34': 3,
  '35–39': 4,
  '40–49': 5,
  '50+': 6,
  'Not specified': 3.5,
};

export function generateTeams({
  participants,
  teamCount,
  seed,
  attempts = 80,
  lockedAssignments = {},
}: {
  participants: TeamGenerationParticipant[];
  teamCount: 2 | 3 | 4;
  seed: string;
  attempts?: number;
  lockedAssignments?: Record<string, number>;
}) {
  const eligibleParticipants = participants.filter((participant) => participant.actual_status === 'Attended' && participant.membership_status !== 'Inactive');
  const targetSizes = getTargetSizes(eligibleParticipants.length, teamCount);
  let bestTeams: TeamGenerationParticipant[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestBreakdown: ScoreBreakdown | null = null;

  for (let attempt = 0; attempt < Math.max(attempts, 1); attempt += 1) {
    const rng = createSeededRandom(`${seed}:${attempt}`);
    const candidate = createCandidate(eligibleParticipants, targetSizes, teamCount, rng, lockedAssignments);
    const improved = improveWithSwaps(candidate, lockedAssignments);
    const { score, breakdown } = scoreTeamBuckets(improved);

    if (score < bestScore) {
      bestTeams = improved;
      bestScore = score;
      bestBreakdown = breakdown;
    }
  }

  const finalTeams = bestTeams ?? Array.from({ length: teamCount }, () => []);

  return {
    teams: finalTeams.map((teamParticipants, index) => ({
      name: teamNames[index],
      participants: teamParticipants,
      summary: summarizeTeam(teamParticipants),
    })),
    score: bestScore,
    scoreBreakdown: bestBreakdown ?? scoreTeamBuckets(finalTeams).breakdown,
    eligibleParticipants,
  };
}

function summarizeTeam(participants: TeamGenerationParticipant[]): TeamSummary {
  const totalFootballLevel = participants.reduce((sum, participant) => sum + participant.football_level, 0);
  const totalAgeScore = participants.reduce((sum, participant) => sum + ageScores[participant.age_group], 0);

  return {
    playerCount: participants.length,
    totalFootballLevel,
    averageFootballLevel: participants.length ? totalFootballLevel / participants.length : 0,
    positionCounts: {
      FW: participants.filter((participant) => participant.primary_position === 'FW').length,
      MF: participants.filter((participant) => participant.primary_position === 'MF').length,
      DF: participants.filter((participant) => participant.primary_position === 'DF').length,
    },
    averageAgeScore: participants.length ? totalAgeScore / participants.length : 0,
  };
}

function createCandidate(participants: TeamGenerationParticipant[], targetSizes: number[], teamCount: number, rng: () => number, lockedAssignments: Record<string, number>) {
  const teams = Array.from({ length: teamCount }, () => [] as TeamGenerationParticipant[]);
  const unlocked = participants.filter((participant) => {
    const lockedTeam = lockedAssignments[getParticipantKey(participant)];
    if (lockedTeam === undefined) return true;
    if (lockedTeam >= 0 && lockedTeam < teamCount && teams[lockedTeam].length < targetSizes[lockedTeam]) {
      teams[lockedTeam].push(participant);
    }
    return false;
  });
  const shuffled = shuffle([...unlocked], rng).sort((left, right) => right.football_level - left.football_level || rng() - 0.5);

  for (const participant of shuffled) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < teamCount; index += 1) {
      if (teams[index].length >= targetSizes[index]) continue;
      const candidate = teams.map((team, teamIndex) => (teamIndex === index ? [...team, participant] : [...team]));
      const { score } = scoreTeamBuckets(candidate);
      if (score < bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }

    teams[bestIndex].push(participant);
  }

  return teams;
}

function improveWithSwaps(teams: TeamGenerationParticipant[][], lockedAssignments: Record<string, number>) {
  let current = teams.map((team) => [...team]);
  let currentScore = scoreTeamBuckets(current).score;
  let improved = true;
  let pass = 0;

  while (improved && pass < 20) {
    improved = false;
    pass += 1;

    for (let leftIndex = 0; leftIndex < current.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < current.length; rightIndex += 1) {
        for (let leftPlayerIndex = 0; leftPlayerIndex < current[leftIndex].length; leftPlayerIndex += 1) {
          for (let rightPlayerIndex = 0; rightPlayerIndex < current[rightIndex].length; rightPlayerIndex += 1) {
            const swapped = current.map((team) => [...team]);
            if (lockedAssignments[getParticipantKey(current[leftIndex][leftPlayerIndex])] !== undefined || lockedAssignments[getParticipantKey(current[rightIndex][rightPlayerIndex])] !== undefined) continue;
            swapped[leftIndex][leftPlayerIndex] = current[rightIndex][rightPlayerIndex];
            swapped[rightIndex][rightPlayerIndex] = current[leftIndex][leftPlayerIndex];
            const swappedScore = scoreTeamBuckets(swapped).score;

            if (swappedScore + 0.0001 < currentScore) {
              current = swapped;
              currentScore = swappedScore;
              improved = true;
            }
          }
        }
      }
    }
  }

  return current;
}

function getParticipantKey(participant: Pick<TeamGenerationParticipant, 'kind' | 'id'>) {
  return `${participant.kind}:${participant.id}`;
}

function scoreTeamBuckets(teams: TeamGenerationParticipant[][]): { score: number; breakdown: ScoreBreakdown } {
  const summaries = teams.map(summarizeTeam);
  const sizes = summaries.map((summary) => summary.playerCount);
  const totalLevels = summaries.map((summary) => summary.totalFootballLevel);
  const averageAges = summaries.map((summary) => summary.averageAgeScore);
  const sizeDifference = Math.max(...sizes) - Math.min(...sizes);
  const primaryPositionImbalance = positions.reduce((sum, position) => sum + variance(summaries.map((summary) => summary.positionCounts[position])), 0);
  const secondaryPositionSupport = positions.reduce(
    (sum, position) =>
      sum +
      variance(
        teams.map((team) => team.filter((participant) => participant.primary_position === position).length + team.filter((participant) => participant.secondary_position === position).length * 0.35),
      ),
    0,
  );
  const breakdown = {
    sizePenalty: sizeDifference > 1 ? 10000 + sizeDifference * 1000 : sizeDifference * 100,
    levelVariance: variance(totalLevels),
    primaryPositionImbalance,
    secondaryPositionSupport,
    ageVariance: variance(averageAges),
  };

  return {
    score: breakdown.sizePenalty + breakdown.levelVariance * 120 + breakdown.primaryPositionImbalance * 35 - breakdown.secondaryPositionSupport * 4 + breakdown.ageVariance * 5,
    breakdown,
  };
}

function getTargetSizes(totalParticipants: number, teamCount: number) {
  const baseSize = Math.floor(totalParticipants / teamCount);
  const remainder = totalParticipants % teamCount;
  return Array.from({ length: teamCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function variance(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function shuffle<T>(items: T[], rng: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
