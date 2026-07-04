import type { Session } from '@supabase/supabase-js';
import type {
  ActualStatus,
  AttendanceInput,
  EventCreateInput,
  EventDetail,
  EventDuplicateInput,
  EventGuest,
  EventGuestInput,
  EventParticipant,
  EventSummary,
  EventTeam,
  EventVotingState,
  GenerateTeamsInput,
  EventUpdateInput,
  GuestAttendanceInput,
  MyRsvp,
  RsvpInput,
  TeamAdjustmentInput,
  VoteInput,
  VoteType,
  VotingResult,
  VotingStatusInput,
} from './events';
import type { FineBoxState, FineRecord, FineTypeRecord } from './fines';
import { normalizeFirstName } from './member-options';
import type { MemberProfile, MemberRegistrationInput } from './member-options';
import type { Phase1Api, SessionState } from './phase1-api';
import { generateTeams as generateBalancedTeams, type TeamGenerationParticipant } from './team-generation';

const demoSession = { access_token: 'demo' } as Session;

let state: SessionState = {
  hasAccess: false,
  selectedMember: null,
  members: [],
};

const demoEventId = 'demo-event-1';
let demoEvents: EventSummary[] = [
  {
    id: demoEventId,
    title: 'Friday Football',
    event_type: 'Football',
    event_date: '2026-07-09',
    start_time: '19:00:00',
    location: 'Yamato Pitch',
    rsvp_deadline: '2026-07-08T18:00:00.000Z',
    status: 'Open',
    my_rsvp_status: null,
    going_count: 8,
    maybe_count: 2,
    not_going_count: 1,
    late_count: 1,
  },
];

const demoRsvps: Record<string, MyRsvp> = {};
let demoTeams: EventTeam[] = [];
const demoVotes: Record<string, VoteInput> = {};
let demoAwards: VotingResult[] = [];
let demoFines: FineRecord[] = [
  {
    id: 'demo-fine-1',
    participant_kind: 'member',
    participant_id: 'demo-member-admin',
    first_name: 'Admin',
    fine_type_name: 'Late arrival',
    description: 'Late arrival',
    amount_dkk: 20,
    payment_status: 'Unpaid',
    related_event_title: 'Friday Football',
    related_event_date: '2026-07-03',
    created_at: '2026-07-03T20:00:00.000Z',
    payment_reported_at: null,
    payment_confirmed_at: null,
    waived_at: null,
  },
  {
    id: 'demo-fine-2',
    participant_kind: 'guest',
    participant_id: 'demo-guest-1',
    first_name: 'Ken',
    fine_type_name: 'Worst Player',
    description: 'Worst Player',
    amount_dkk: 50,
    payment_status: 'Unpaid',
    related_event_title: 'Friday Football',
    related_event_date: '2026-07-03',
    created_at: '2026-07-03T20:05:00.000Z',
    payment_reported_at: null,
    payment_confirmed_at: null,
    waived_at: null,
  },
  {
    id: 'demo-fine-3',
    participant_kind: 'member',
    participant_id: 'demo-member-admin',
    first_name: 'Admin',
    fine_type_name: 'Forgot equipment',
    description: 'Forgot bibs',
    amount_dkk: 30,
    payment_status: 'Paid',
    related_event_title: 'Friday Football',
    related_event_date: '2026-06-26',
    created_at: '2026-06-26T20:00:00.000Z',
    payment_reported_at: '2026-06-27T08:00:00.000Z',
    payment_confirmed_at: '2026-06-27T09:00:00.000Z',
    waived_at: null,
  },
];
let demoFineTypes: FineTypeRecord[] = [
  {
    id: 'demo-fine-type-late',
    name: 'Late arrival',
    default_amount_dkk: 20,
    is_active: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'demo-fine-type-worst',
    name: 'Worst Player',
    default_amount_dkk: 50,
    is_active: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'demo-fine-type-equipment',
    name: 'Forgot equipment',
    default_amount_dkk: 30,
    is_active: false,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
];
let demoGuests: EventGuest[] = [
  {
    id: 'demo-guest-1',
    event_id: demoEventId,
    first_name: 'Ken',
    first_name_normalized: 'ken',
    age_group: '30–34',
    football_level: 3,
    primary_position: 'MF',
    secondary_position: null,
    residence_type: 'Local resident',
    gender: 'Male',
    actual_status: 'Not confirmed',
    created_by: null,
    created_at: '2026-06-30T00:00:00.000Z',
  },
];
const demoActualStatuses: Record<string, ActualStatus> = {};

function voteKey(eventId: string, memberId: string, voteType: VoteType) {
  return `${eventId}:${memberId}:${voteType}`;
}

async function buildDemoVotingState(eventId: string): Promise<EventVotingState> {
  const detail = await demoPhase1Api.getEventDetail(eventId);
  const selectedMember = state.selectedMember;
  const candidates = detail.participants
    .filter((participant) => participant.actual_status === 'Attended')
    .map((participant) => ({
      kind: participant.kind,
      id: participant.id,
      first_name: participant.first_name,
    }))
    .sort((left, right) => left.first_name.localeCompare(right.first_name));
  const myVotes: EventVotingState['myVotes'] = {};

  if (selectedMember) {
    for (const voteType of ['MVP', 'Worst'] as const) {
      const vote = demoVotes[voteKey(eventId, selectedMember.id, voteType)];
      if (vote) {
        myVotes[voteType] = {
          candidateKind: vote.candidateKind,
          candidateId: vote.candidateId,
        };
      }
    }
  }

  const myParticipant = detail.participants.find((participant) => participant.kind === 'member' && participant.id === selectedMember?.id);

  const visibleAwards =
    detail.event.status === 'Completed'
      ? demoAwards.filter((award) => award.is_admin_override || !demoAwards.some((override) => override.vote_type === award.vote_type && override.is_admin_override))
      : [];

  return {
    eventId,
    status: detail.event.status,
    enableVoting: detail.event.enable_voting,
    isEligibleVoter: Boolean(selectedMember && selectedMember.membership_status === 'Active' && myParticipant?.actual_status === 'Attended' && detail.event.status === 'Voting open' && detail.event.enable_voting),
    candidates,
    myVotes,
    results: visibleAwards,
  };
}

function calculateDemoAwards(eventId: string, candidates: EventVotingState['candidates']): VotingResult[] {
  const awards: VotingResult[] = [];
  for (const voteType of ['MVP', 'Worst'] as const) {
    const counts = new Map<string, number>();
    Object.values(demoVotes)
      .filter((vote) => vote.eventId === eventId && vote.voteType === voteType)
      .forEach((vote) => {
        const key = `${vote.candidateKind}:${vote.candidateId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    const max = Math.max(0, ...counts.values());
    if (max === 0) continue;
    for (const [key, voteCount] of counts) {
      if (voteCount !== max) continue;
      const [kind, id] = key.split(':') as ['member' | 'guest', string];
      const candidate = candidates.find((item) => item.kind === kind && item.id === id);
      if (!candidate) continue;
      awards.push({
        ...candidate,
        vote_type: voteType,
        vote_count: voteCount,
        is_winner: true,
        is_admin_override: false,
      });
    }
  }
  return awards;
}

function toMember(input: MemberRegistrationInput): MemberProfile {
  const memberId = normalizeFirstName(input.firstName) === 'admin' ? 'demo-member-admin' : crypto.randomUUID();
  return {
    id: memberId,
    first_name: input.firstName.trim().replace(/\s+/g, ' '),
    age_group: input.ageGroup,
    football_level: input.footballLevel,
    primary_position: input.primaryPosition,
    secondary_position: input.secondaryPosition === 'None' ? null : input.secondaryPosition,
    residence_type: input.residenceType,
    gender: input.gender,
    membership_status: 'Active',
    application_role: normalizeFirstName(input.firstName) === 'admin' ? 'Admin' : 'Player',
    created_at: new Date().toISOString(),
  };
}

function buildDemoFineBox(): FineBoxState {
  const totals = {
    unpaid_total_dkk: 0,
    payment_reported_total_dkk: 0,
    paid_total_dkk: 0,
    waived_total_dkk: 0,
  };

  for (const fine of demoFines) {
    if (fine.payment_status === 'Unpaid') totals.unpaid_total_dkk += fine.amount_dkk;
    if (fine.payment_status === 'Payment reported') totals.payment_reported_total_dkk += fine.amount_dkk;
    if (fine.payment_status === 'Paid') totals.paid_total_dkk += fine.amount_dkk;
    if (fine.payment_status === 'Waived') totals.waived_total_dkk += fine.amount_dkk;
  }

  return {
    settings: {
      mobilepay_box_number: '2391JB',
      mobilepay_url: 'https://qr.mobilepay.dk/box/703316ba-f36a-4335-9a16-f2ffbc1a02f8/pay-in',
      payment_instructions: 'Use your first name as the payment reference.',
    },
    summary: totals,
    fines: demoFines,
    fineTypes: demoFineTypes,
    participants: [
      ...state.members
        .filter((member) => member.membership_status === 'Active')
        .map((member) => ({
          kind: 'member' as const,
          id: member.id,
          first_name: member.first_name,
          context: null,
        })),
      ...demoGuests.map((guest) => ({
        kind: 'guest' as const,
        id: guest.id,
        first_name: guest.first_name,
        context: demoEvents.find((event) => event.id === guest.event_id)?.title ?? null,
      })),
    ],
  };
}

export const demoPhase1Api: Phase1Api = {
  async ensureAnonymousSession() {
    return demoSession;
  },

  async getSessionState() {
    return state;
  },

  async verifyTeamPassword(password: string) {
    if (password !== 'demo') {
      throw new Error('Incorrect team password');
    }

    state = { ...state, hasAccess: true };
  },

  async registerMember(input: MemberRegistrationInput) {
    const member = toMember(input);
    state = {
      hasAccess: true,
      selectedMember: member,
      members: [...state.members, member],
    };
  },

  async updateMember(input) {
    if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
    if (!input.firstName.trim()) throw new Error('First name is required.');
    if (state.members.some((member) => member.id !== input.memberId && normalizeFirstName(member.first_name) === normalizeFirstName(input.firstName))) {
      throw new Error('This name is already in use. Please choose another name or nickname.');
    }

    const nextMembers = state.members.map((member) =>
      member.id === input.memberId
        ? {
            ...member,
            first_name: input.firstName.trim().replace(/\s+/g, ' '),
            age_group: input.ageGroup,
            football_level: input.footballLevel,
            primary_position: input.primaryPosition,
            secondary_position: input.secondaryPosition === 'None' ? null : input.secondaryPosition,
            residence_type: input.residenceType,
            gender: input.gender,
            membership_status: input.membershipStatus,
            application_role: input.applicationRole,
          }
        : member,
    );

    if (nextMembers.every((member) => member.id !== input.memberId)) throw new Error('Member not found');
    state = {
      ...state,
      members: nextMembers,
      selectedMember: state.selectedMember ? nextMembers.find((member) => member.id === state.selectedMember?.id) ?? state.selectedMember : null,
    };
  },

  async selectProfile(memberId: string) {
    const selectedMember = state.members.find((member) => member.id === memberId) ?? null;
    if (!selectedMember) throw new Error('Member not found');
    state = { ...state, selectedMember };
  },

  async listEvents() {
    return demoEvents.map((event) => ({
      ...event,
      my_rsvp_status: demoRsvps[event.id]?.rsvp_status ?? null,
    }));
  },

  async listAnalyticsEvents(seasonYear: number) {
    if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');

    return demoEvents
      .filter((event) => event.event_date.startsWith(`${seasonYear}-`))
      .map((event) => ({
        ...event,
        my_rsvp_status: demoRsvps[event.id]?.rsvp_status ?? null,
      }));
  },

  async getEventDetail(eventId: string) {
    const summary = demoEvents.find((event) => event.id === eventId);
    if (!summary) throw new Error('Event not found');
    const memberParticipants: EventParticipant[] = Object.values(demoRsvps)
      .filter((rsvp) => rsvp.event_id === eventId)
      .map((rsvp) => {
        const member = state.members.find((profile) => profile.id === rsvp.member_id);
        return {
          kind: 'member',
          id: rsvp.member_id,
          first_name: member?.first_name ?? 'Member',
          rsvp_status: rsvp.rsvp_status,
          is_arriving_late: rsvp.is_arriving_late,
          expected_arrival_time: rsvp.expected_arrival_time,
          actual_status: demoActualStatuses[rsvp.member_id] ?? 'Not confirmed',
          football_level: member?.football_level ?? 3,
          primary_position: member?.primary_position ?? 'MF',
          secondary_position: member?.secondary_position ?? null,
          age_group: member?.age_group ?? 'Not specified',
        };
      });
    const guestParticipants: EventParticipant[] = demoGuests
      .filter((guest) => guest.event_id === eventId)
      .map((guest) => ({
        kind: 'guest',
        id: guest.id,
        first_name: guest.first_name,
        rsvp_status: null,
        is_arriving_late: false,
        expected_arrival_time: null,
        actual_status: guest.actual_status,
        football_level: guest.football_level,
        primary_position: guest.primary_position,
        secondary_position: guest.secondary_position,
        age_group: guest.age_group,
      }));
    const participants = [...memberParticipants, ...guestParticipants];

    return {
      event: {
        ...summary,
        team_id: 'demo-team',
        season_id: 'demo-season',
        number_of_teams: 2,
        notes: 'Bring a dark and a light shirt.',
        enable_team_generation: true,
        enable_voting: true,
        created_by: null,
        created_at: '2026-06-30T00:00:00.000Z',
        updated_at: '2026-06-30T00:00:00.000Z',
      },
      myRsvp: demoRsvps[eventId] ?? null,
      counts: {
        going: summary.going_count,
        maybe: summary.maybe_count,
        notGoing: summary.not_going_count,
        late: summary.late_count,
        attended: participants.filter((participant) => participant.actual_status === 'Attended').length,
        guests: guestParticipants.length,
      },
      participants,
      guests: demoGuests.filter((guest) => guest.event_id === eventId),
    } satisfies EventDetail;
  },

  async createEvent(input: EventCreateInput) {
    const id = crypto.randomUUID();
    demoEvents = [
      ...demoEvents,
      {
        id,
        title: input.title,
        event_type: input.eventType,
        event_date: input.eventDate,
        start_time: input.startTime,
        location: input.location,
        rsvp_deadline: input.rsvpDeadline,
        status: input.status,
        my_rsvp_status: null,
        going_count: 0,
        maybe_count: 0,
        not_going_count: 0,
        late_count: 0,
      },
    ];
    return id;
  },

  async updateEvent(input: EventUpdateInput) {
    demoEvents = demoEvents.map((event) =>
      event.id === input.eventId
        ? {
            ...event,
            title: input.title,
            event_type: input.eventType,
            event_date: input.eventDate,
            start_time: input.startTime,
            location: input.location,
            rsvp_deadline: input.rsvpDeadline,
            status: input.status,
          }
        : event,
    );
    return input.eventId;
  },

  async duplicateEvent(input: EventDuplicateInput) {
    const source = demoEvents.find((event) => event.id === input.eventId);
    if (!source) throw new Error('Event not found');
    if (input.eventDate === source.event_date) throw new Error('Choose a new date for the duplicated event');

    const id = crypto.randomUUID();
    demoEvents = [
      ...demoEvents,
      {
        ...source,
        id,
        event_date: input.eventDate,
        my_rsvp_status: null,
        going_count: 0,
        maybe_count: 0,
        not_going_count: 0,
        late_count: 0,
        status: 'Open',
      },
    ];
    return id;
  },

  async updateRsvp(input: RsvpInput) {
    if (!state.selectedMember) throw new Error('No active member profile selected');

    const rsvp: MyRsvp = {
      id: crypto.randomUUID(),
      event_id: input.eventId,
      member_id: state.selectedMember.id,
      rsvp_status: input.rsvpStatus,
      is_arriving_late: input.rsvpStatus === 'Going' && input.isArrivingLate,
      expected_arrival_time: input.rsvpStatus === 'Going' && input.isArrivingLate && input.expectedArrivalTime ? input.expectedArrivalTime : null,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      was_updated_after_deadline: false,
    };
    demoRsvps[input.eventId] = rsvp;
    demoEvents = demoEvents.map((event) => (event.id === input.eventId ? { ...event, my_rsvp_status: input.rsvpStatus } : event));
  },

  async createEventGuest(input: EventGuestInput) {
    const normalizedName = normalizeFirstName(input.firstName);
    const detail = await this.getEventDetail(input.eventId);
    if (detail.participants.some((participant) => normalizeFirstName(participant.first_name) === normalizedName)) {
      throw new Error('This name is already used by a participant in this event.');
    }

    const guest: EventGuest = {
      id: crypto.randomUUID(),
      event_id: input.eventId,
      first_name: input.firstName.trim().replace(/\s+/g, ' '),
      first_name_normalized: normalizedName,
      age_group: input.ageGroup,
      football_level: input.footballLevel,
      primary_position: input.primaryPosition,
      secondary_position: input.secondaryPosition === 'None' ? null : input.secondaryPosition,
      residence_type: input.residenceType,
      gender: input.gender,
      actual_status: 'Not confirmed',
      created_by: null,
      created_at: new Date().toISOString(),
    };
    demoGuests = [...demoGuests, guest];
    return guest.id;
  },

  async updateAttendance(input: AttendanceInput) {
    demoActualStatuses[input.memberId] = input.actualStatus;
  },

  async updateGuestAttendance(input: GuestAttendanceInput) {
    demoGuests = demoGuests.map((guest) => (guest.id === input.eventGuestId ? { ...guest, actual_status: input.actualStatus } : guest));
  },

  async getEventTeams(eventId: string) {
    return demoTeams.filter((team) => team.event_id === eventId);
  },

  async generateTeams(input: GenerateTeamsInput) {
    const detail = await this.getEventDetail(input.eventId);
    const lockedAssignments: Record<string, number> = {};
    const lockedState: Record<string, boolean> = {};
    const existingTeamNames = demoTeams.filter((team) => team.event_id === input.eventId).sort((left, right) => left.display_order - right.display_order).map((team) => team.name);

    if (input.preserveLocked) {
      demoTeams
        .filter((team) => team.event_id === input.eventId)
        .forEach((team, teamIndex) => {
          team.participants.forEach((participant) => {
            const key = `${participant.kind}:${participant.id}`;
            lockedState[key] = participant.is_locked;
            if (participant.is_locked) {
              lockedAssignments[key] = teamIndex;
            }
          });
        });
    }

    const result = generateBalancedTeams({
      participants: detail.participants.map(
        (participant): TeamGenerationParticipant => ({
          ...participant,
          membership_status: 'Active',
        }),
      ),
      teamCount: input.teamCount,
      seed: `${input.eventId}:${input.attemptNumber}`,
      lockedAssignments,
    });

    demoTeams = result.teams.map((team, index) => {
      return {
        id: `demo-team-${input.eventId}-${index}`,
        event_id: input.eventId,
        name: input.preserveLocked ? (existingTeamNames[index] ?? team.name) : team.name,
        display_order: index,
        is_confirmed: false,
        balance_score: result.score,
        score_breakdown: result.scoreBreakdown,
        participants: team.participants.map((participant) => ({
          kind: participant.kind,
          id: participant.id,
          first_name: participant.first_name,
          football_level: participant.football_level,
          primary_position: participant.primary_position,
          secondary_position: participant.secondary_position,
          age_group: participant.age_group,
          is_locked: lockedState[`${participant.kind}:${participant.id}`] === true,
        })),
      };
    });

    return demoTeams;
  },

  async adjustTeam(input: TeamAdjustmentInput) {
    if (input.action === 'move-participant') {
      const sourceTeam = demoTeams.find((team) => team.participants.some((participant) => participant.kind === input.participantKind && participant.id === input.participantId));
      const targetTeam = demoTeams.find((team) => team.id === input.targetTeamId);
      const participant = sourceTeam?.participants.find((item) => item.kind === input.participantKind && item.id === input.participantId);
      if (!sourceTeam || !targetTeam || !participant) throw new Error('Draft participant not found');
      if (participant.is_locked) throw new Error('Unlock this participant before moving');

      demoTeams = demoTeams.map((team) => {
        if (team.id === sourceTeam.id) {
          return { ...team, balance_score: null, score_breakdown: null, participants: team.participants.filter((item) => !(item.kind === input.participantKind && item.id === input.participantId)) };
        }
        if (team.id === targetTeam.id) {
          return { ...team, balance_score: null, score_breakdown: null, participants: [...team.participants, participant] };
        }
        return { ...team, balance_score: null, score_breakdown: null };
      });
    }

    if (input.action === 'remove-participant') {
      const sourceTeam = demoTeams.find((team) => team.participants.some((participant) => participant.kind === input.participantKind && participant.id === input.participantId));
      const participant = sourceTeam?.participants.find((item) => item.kind === input.participantKind && item.id === input.participantId);
      if (!sourceTeam || !participant) throw new Error('Draft participant not found');
      if (participant.is_locked) throw new Error('Unlock this participant before removing');

      demoTeams = demoTeams.map((team) => ({
        ...team,
        balance_score: null,
        score_breakdown: null,
        participants: team.participants.filter((item) => !(item.kind === input.participantKind && item.id === input.participantId)),
      }));
    }

    if (input.action === 'swap-participants') {
      const sourceTeam = demoTeams.find((team) => team.participants.some((participant) => participant.kind === input.participantKind && participant.id === input.participantId));
      const swapTeam = demoTeams.find((team) => team.participants.some((participant) => participant.kind === input.swapParticipantKind && participant.id === input.swapParticipantId));
      const participant = sourceTeam?.participants.find((item) => item.kind === input.participantKind && item.id === input.participantId);
      const swapParticipant = swapTeam?.participants.find((item) => item.kind === input.swapParticipantKind && item.id === input.swapParticipantId);
      if (!sourceTeam || !swapTeam || !participant || !swapParticipant) throw new Error('Draft participant not found');
      if (participant.is_locked || swapParticipant.is_locked) throw new Error('Unlock participants before swapping');

      demoTeams = demoTeams.map((team) => {
        if (team.id === sourceTeam.id) {
          return {
            ...team,
            balance_score: null,
            score_breakdown: null,
            participants: team.participants.map((item) => (item.kind === input.participantKind && item.id === input.participantId ? swapParticipant : item)),
          };
        }
        if (team.id === swapTeam.id) {
          return {
            ...team,
            balance_score: null,
            score_breakdown: null,
            participants: team.participants.map((item) => (item.kind === input.swapParticipantKind && item.id === input.swapParticipantId ? participant : item)),
          };
        }
        return { ...team, balance_score: null, score_breakdown: null };
      });
    }

    if (input.action === 'toggle-lock') {
      demoTeams = demoTeams.map((team) => ({
        ...team,
        participants: team.participants.map((participant) =>
          participant.kind === input.participantKind && participant.id === input.participantId ? { ...participant, is_locked: input.isLocked } : participant,
        ),
      }));
    }

    if (input.action === 'rename-team') {
      if (!input.name.trim()) throw new Error('Team name is required');
      demoTeams = demoTeams.map((team) => (team.id === input.teamId ? { ...team, name: input.name.trim() } : team));
    }

    if (input.action === 'confirm-teams') {
      demoTeams = demoTeams.map((team) => (team.event_id === input.eventId ? { ...team, is_confirmed: true } : team));
      demoEvents = demoEvents.map((event) => (event.id === input.eventId ? { ...event, status: 'Teams confirmed' } : event));
    }

    return demoTeams.filter((team) => team.event_id === input.eventId);
  },

  async getEventVoting(eventId: string) {
    return buildDemoVotingState(eventId);
  },

  async submitVote(input: VoteInput) {
    const voting = await buildDemoVotingState(input.eventId);
    const selectedMember = state.selectedMember;
    if (!selectedMember || !voting.isEligibleVoter) throw new Error('Only attended active members can vote');
    if (input.candidateKind === 'member' && input.candidateId === selectedMember.id) throw new Error('You cannot vote for yourself');
    if (!voting.candidates.some((candidate) => candidate.kind === input.candidateKind && candidate.id === input.candidateId)) throw new Error('Candidate is not eligible');

    demoVotes[voteKey(input.eventId, selectedMember.id, input.voteType)] = input;
    return buildDemoVotingState(input.eventId);
  },

  async setVotingStatus(input: VotingStatusInput) {
    const selectedMember = state.selectedMember;
    if (selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');

    if (input.status === 'Voting open') {
      demoEvents = demoEvents.map((event) => (event.id === input.eventId ? { ...event, status: 'Voting open' } : event));
      demoAwards = [];
      return buildDemoVotingState(input.eventId);
    }

    const voting = await buildDemoVotingState(input.eventId);
    demoAwards = calculateDemoAwards(input.eventId, voting.candidates);
    demoEvents = demoEvents.map((event) => (event.id === input.eventId ? { ...event, status: 'Completed' } : event));
    return buildDemoVotingState(input.eventId);
  },

  async overrideAward(input) {
    const selectedMember = state.selectedMember;
    if (selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');

    const voting = await buildDemoVotingState(input.eventId);
    if (voting.status !== 'Completed') throw new Error('Awards can only be overridden after voting is completed');

    const candidate = voting.candidates.find((item) => item.kind === input.candidateKind && item.id === input.candidateId);
    if (!candidate) throw new Error('Candidate is not eligible');

    const voteCount = Object.values(demoVotes).filter((vote) => vote.eventId === input.eventId && vote.voteType === input.awardType && vote.candidateKind === input.candidateKind && vote.candidateId === input.candidateId).length;

    demoAwards = [
      ...demoAwards.filter((award) => award.vote_type !== input.awardType || !award.is_admin_override),
      {
        ...candidate,
        vote_type: input.awardType,
        vote_count: voteCount,
        is_winner: true,
        is_admin_override: true,
      },
    ];

    return buildDemoVotingState(input.eventId);
  },

  async getFineBox() {
    return buildDemoFineBox();
  },

  async reportFinePayment(input) {
    const selectedMember = state.selectedMember;
    if (!selectedMember) throw new Error('Select a member profile before reporting payment');
    if (input.fineIds.length === 0) throw new Error('Select at least one fine');

    const invalidFine = demoFines.find(
      (fine) => input.fineIds.includes(fine.id) && (fine.participant_kind !== 'member' || fine.participant_id !== selectedMember.id || fine.payment_status !== 'Unpaid'),
    );
    if (invalidFine) throw new Error('Only your unpaid member fines can be reported');

    demoFines = demoFines.map((fine) =>
      input.fineIds.includes(fine.id)
        ? {
            ...fine,
            payment_status: 'Payment reported',
            payment_reported_at: new Date().toISOString(),
          }
        : fine,
    );

    return buildDemoFineBox();
  },

  async createFine(input) {
    const selectedMember = state.selectedMember;
    if (selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
    const participant = buildDemoFineBox().participants.find((item) => item.kind === input.participantKind && item.id === input.participantId);
    if (!participant) throw new Error('Participant is required');
    if (!input.description.trim()) throw new Error('Description is required');
    if (input.amountDkk <= 0) throw new Error('Amount must be greater than 0');
    const fineType = input.fineTypeId ? demoFineTypes.find((item) => item.id === input.fineTypeId && item.is_active) : null;
    if (input.fineTypeId && !fineType) throw new Error('Fine type is not active');

    demoFines = [
      {
        id: crypto.randomUUID(),
        participant_kind: input.participantKind,
        participant_id: input.participantId,
        first_name: participant.first_name,
        fine_type_name: fineType?.name ?? null,
        description: input.description.trim(),
        amount_dkk: input.amountDkk,
        payment_status: 'Unpaid',
        related_event_title: participant.context,
        related_event_date: participant.kind === 'guest' ? '2026-07-03' : null,
        created_at: new Date().toISOString(),
        payment_reported_at: null,
        payment_confirmed_at: null,
        waived_at: null,
      },
      ...demoFines,
    ];

    return buildDemoFineBox();
  },

  async createFines(input) {
    const selectedMember = state.selectedMember;
    if (selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
    if (input.participants.length === 0) throw new Error('Select at least one participant');
    if (!input.description.trim()) throw new Error('Description is required');
    if (input.amountDkk <= 0) throw new Error('Amount must be greater than 0');
    const fineType = input.fineTypeId ? demoFineTypes.find((item) => item.id === input.fineTypeId && item.is_active) : null;
    if (input.fineTypeId && !fineType) throw new Error('Fine type is not active');

    const participantOptions = buildDemoFineBox().participants;
    const nextFines = input.participants.map((selection) => {
      const participant = participantOptions.find((item) => item.kind === selection.kind && item.id === selection.id);
      if (!participant) throw new Error('Participant is required');
      return {
        id: crypto.randomUUID(),
        participant_kind: selection.kind,
        participant_id: selection.id,
        first_name: participant.first_name,
        fine_type_name: fineType?.name ?? null,
        description: input.description.trim(),
        amount_dkk: input.amountDkk,
        payment_status: 'Unpaid' as const,
        related_event_title: participant.context,
        related_event_date: participant.kind === 'guest' ? '2026-07-03' : null,
        created_at: new Date().toISOString(),
        payment_reported_at: null,
        payment_confirmed_at: null,
        waived_at: null,
      };
    });

    demoFines = [...nextFines, ...demoFines];

    return buildDemoFineBox();
  },

  async updateFineStatus(input) {
    const selectedMember = state.selectedMember;
    if (selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');

    const fine = demoFines.find((item) => item.id === input.fineId);
    if (!fine) throw new Error('Fine is required');

    if (input.action === 'confirm-paid' && fine.payment_status !== 'Payment reported') {
      throw new Error('Only reported payments can be confirmed');
    }
    if (input.action === 'waive' && fine.payment_status !== 'Unpaid' && fine.payment_status !== 'Payment reported') {
      throw new Error('Only unpaid or reported fines can be waived');
    }

    demoFines = demoFines.map((item) => {
      if (item.id !== input.fineId) return item;
      if (input.action === 'confirm-paid') {
        return { ...item, payment_status: 'Paid', payment_confirmed_at: new Date().toISOString() };
      }
      return { ...item, payment_status: 'Waived', waived_at: new Date().toISOString() };
    });

    return buildDemoFineBox();
  },

  async createFineType(input) {
    const selectedMember = state.selectedMember;
    if (selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
    const name = input.name.trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Fine type name is required');
    if (!Number.isInteger(input.defaultAmountDkk) || input.defaultAmountDkk < 0) throw new Error('Default amount must be 0 or more');
    if (demoFineTypes.some((type) => type.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('This fine type already exists.');
    }

    demoFineTypes = [
      ...demoFineTypes,
      {
        id: crypto.randomUUID(),
        name,
        default_amount_dkk: input.defaultAmountDkk,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    return buildDemoFineBox();
  },

  async updateFineType(input) {
    const selectedMember = state.selectedMember;
    if (selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
    if (!demoFineTypes.some((type) => type.id === input.fineTypeId)) throw new Error('Fine type is required');

    demoFineTypes = demoFineTypes.map((type) => (type.id === input.fineTypeId ? { ...type, is_active: input.isActive, updated_at: new Date().toISOString() } : type));

    return buildDemoFineBox();
  },
};
