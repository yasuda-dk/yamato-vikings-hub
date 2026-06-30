import type { Session } from '@supabase/supabase-js';
import type { EventCreateInput, EventDetail, EventSummary, MyRsvp, RsvpInput } from './events';
import type { MemberProfile, MemberRegistrationInput } from './member-options';
import type { Phase1Api, SessionState } from './phase1-api';

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
    application_role: 'Player',
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
      },
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
};
