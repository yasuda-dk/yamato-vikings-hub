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
  GenerateTeamsInput,
  EventUpdateInput,
  GuestAttendanceInput,
  MyRsvp,
  RsvpInput,
  TeamAdjustmentInput,
} from './events';
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
    event_date: '2026-07-03',
    start_time: '19:00:00',
    location: 'Yamato Pitch',
    rsvp_deadline: '2026-07-02T18:00:00.000Z',
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

function toMember(input: MemberRegistrationInput): MemberProfile {
  return {
    id: crypto.randomUUID(),
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
};
