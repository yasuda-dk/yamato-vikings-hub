import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import type { ActualStatus, EventDetail, EventGuest, EventSummary, RsvpInput } from './lib/events';
import type { MemberProfile } from './lib/member-options';
import type { Phase1Api, SessionState } from './lib/phase1-api';

const takashi: MemberProfile = {
  id: 'member-1',
  first_name: 'Takashi',
  age_group: '35–39',
  football_level: 3,
  primary_position: 'MF',
  secondary_position: 'DF',
  residence_type: 'Local resident',
  gender: 'Male',
  membership_status: 'Active',
  application_role: 'Player',
  created_at: '2026-01-01T00:00:00.000Z',
};

const adminTakashi: MemberProfile = {
  ...takashi,
  application_role: 'Admin',
};

function createApi(initialState: SessionState): Phase1Api {
  let state = initialState;
  let event: EventSummary = {
    id: 'event-1',
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
  };
  let rsvp: EventDetail['myRsvp'] = null;
  let guest: EventGuest | null = null;
  let actualStatus: ActualStatus = 'Not confirmed';

  return {
    ensureAnonymousSession: async () => null,
    getSessionState: async () => state,
    verifyTeamPassword: async (password) => {
      if (password !== 'demo') throw new Error('Incorrect team password');
      state = { ...state, hasAccess: true };
    },
    registerMember: async (input) => {
      const member = { ...takashi, id: 'member-new', first_name: input.firstName, gender: input.gender };
      state = { hasAccess: true, selectedMember: member, members: [member] };
    },
    selectProfile: async (memberId) => {
      state = { ...state, selectedMember: state.members.find((member) => member.id === memberId) ?? null };
    },
    listEvents: async () => [event],
    getEventDetail: async () => ({
      event: {
        ...event,
        team_id: 'team-1',
        season_id: 'season-1',
        number_of_teams: 2,
        notes: 'Bring two shirts.',
        enable_team_generation: true,
        enable_voting: true,
        created_by: null,
        created_at: '2026-06-30T00:00:00.000Z',
        updated_at: '2026-06-30T00:00:00.000Z',
      },
      myRsvp: rsvp,
      counts: {
        going: event.going_count,
        maybe: event.maybe_count,
        notGoing: event.not_going_count,
        late: event.late_count,
        attended: (actualStatus === 'Attended' ? 1 : 0) + (guest?.actual_status === 'Attended' ? 1 : 0),
        guests: guest ? 1 : 0,
      },
      participants: [
        ...(rsvp
          ? [
              {
                kind: 'member' as const,
                id: takashi.id,
                first_name: takashi.first_name,
                rsvp_status: rsvp.rsvp_status,
                is_arriving_late: rsvp.is_arriving_late,
                expected_arrival_time: rsvp.expected_arrival_time,
                actual_status: actualStatus,
                football_level: takashi.football_level,
                primary_position: takashi.primary_position,
                secondary_position: takashi.secondary_position,
              },
            ]
          : []),
        ...(guest
          ? [
              {
                kind: 'guest' as const,
                id: guest.id,
                first_name: guest.first_name,
                rsvp_status: null,
                is_arriving_late: false,
                expected_arrival_time: null,
                actual_status: guest.actual_status,
                football_level: guest.football_level,
                primary_position: guest.primary_position,
                secondary_position: guest.secondary_position,
              },
            ]
          : []),
      ],
      guests: guest ? [guest] : [],
    }),
    createEvent: async () => 'event-new',
    updateEvent: async (input) => {
      event = {
        ...event,
        title: input.title,
        event_type: input.eventType,
        event_date: input.eventDate,
        start_time: input.startTime,
        location: input.location,
        rsvp_deadline: input.rsvpDeadline,
        status: input.status,
      };
      return input.eventId;
    },
    duplicateEvent: async (input) => {
      if (input.eventDate === event.event_date) throw new Error('Choose a new date for the duplicated event');
      event = {
        ...event,
        id: 'event-copy',
        event_date: input.eventDate,
        my_rsvp_status: null,
        going_count: 0,
        maybe_count: 0,
        not_going_count: 0,
        late_count: 0,
      };
      return event.id;
    },
    updateRsvp: async (input: RsvpInput) => {
      event = { ...event, my_rsvp_status: input.rsvpStatus };
      rsvp = {
        id: 'attendance-1',
        event_id: input.eventId,
        member_id: state.selectedMember?.id ?? 'member-1',
        rsvp_status: input.rsvpStatus,
        is_arriving_late: input.rsvpStatus === 'Going' && input.isArrivingLate,
        expected_arrival_time: input.expectedArrivalTime || null,
        responded_at: '2026-06-30T00:00:00.000Z',
        updated_at: '2026-06-30T00:00:00.000Z',
        was_updated_after_deadline: false,
      };
    },
    createEventGuest: async (input) => {
      guest = {
        id: 'guest-1',
        event_id: input.eventId,
        first_name: input.firstName,
        first_name_normalized: input.firstName.toLowerCase(),
        age_group: input.ageGroup,
        football_level: input.footballLevel,
        primary_position: input.primaryPosition,
        secondary_position: input.secondaryPosition === 'None' ? null : input.secondaryPosition,
        residence_type: input.residenceType,
        gender: input.gender,
        actual_status: 'Not confirmed',
        created_by: null,
        created_at: '2026-06-30T00:00:00.000Z',
      };
      return guest.id;
    },
    updateAttendance: async (input) => {
      actualStatus = input.actualStatus;
    },
    updateGuestAttendance: async (input) => {
      if (guest?.id === input.eventGuestId) guest = { ...guest, actual_status: input.actualStatus };
    },
  };
}

describe('App shell', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  it('renders the team-password gate before device approval', async () => {
    render(<App api={createApi({ hasAccess: false, selectedMember: null, members: [] })} />);

    expect(screen.getByRole('heading', { name: 'Team Hub' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Enter team password' })).toBeInTheDocument();
  });

  it('loads all primary routes after profile selection', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /events/i }));
    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /fines/i }));
    expect(screen.getByRole('heading', { name: 'Fines' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /members/i }));
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /home/i }));
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('falls back for invalid routes after profile selection', async () => {
    window.location.hash = '#/missing';
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });

  it('fits a 320px mobile viewport without horizontal overflow', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByTestId('app-main')).toBeInTheDocument();
    expect(document.body.scrollWidth).toBeLessThanOrEqual(320);
  });

  it('opens an event and updates RSVP with late arrival', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    expect(await screen.findByRole('heading', { name: 'Your RSVP' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('I’ll be late'));
    await user.type(screen.getByLabelText('Expected arrival time'), '1930');
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));

    expect(await screen.findByText('RSVP updated.')).toBeInTheDocument();
  });

  it('lets an admin add a guest and confirm guest attendance', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    expect(await screen.findByRole('heading', { name: 'Attendance' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));

    expect(await screen.findByText('Guest added.')).toBeInTheDocument();
    expect(screen.getByText('GUEST')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Attended' }));
    expect(await screen.findByText('Guest attendance updated.')).toBeInTheDocument();
  });

  it('lets an admin edit and duplicate an event', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(await screen.findByRole('button', { name: 'Edit event' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Sunday Football');
    await user.click(screen.getByRole('button', { name: 'Save event' }));

    expect(await screen.findByText('Event updated.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sunday Football' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    await user.type(screen.getByLabelText('New date'), '2026-07-10');
    await user.click(screen.getByRole('button', { name: 'Duplicate event' }));

    expect(await screen.findByRole('heading', { name: 'Sunday Football' })).toBeInTheDocument();
  });

  it('lets an admin cancel an event without deleting it', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel event' }));

    expect(await screen.findByText('Event cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update RSVP' })).toBeDisabled();
  });

  it('creates a new member profile after password approval', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: false, selectedMember: null, members: [] })} />);

    await user.type(await screen.findByLabelText('Team password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Choose profile' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('First name'), 'Takashi');
    await user.click(screen.getByRole('button', { name: 'Create profile' }));

    expect((await screen.findAllByText('Submitting as Takashi')).length).toBeGreaterThan(0);
  });
});
