import { describe, expect, it } from 'vitest';
import {
  createDefaultGuestInput,
  defaultEventSettings,
  filterUpcomingEvents,
  formatEventDate,
  isUpcomingEventDate,
  validateDuplicateInput,
  validateEventGuestInput,
  validateEventInput,
  validateRsvpInput,
  type EventCreateInput,
  type EventSummary,
} from './events';

const validEvent: EventCreateInput = {
  title: 'Friday Football',
  eventType: 'Football',
  eventDate: '2026-07-03',
  startTime: '19:00',
  location: 'Yamato Pitch',
  rsvpDeadline: '2026-07-02T18:00',
  numberOfTeams: 2,
  notes: '',
  enableTeamGeneration: true,
  enableVoting: true,
  status: 'Open',
};

describe('event helpers', () => {
  it('uses sensible defaults by event type', () => {
    expect(defaultEventSettings('Football')).toEqual({ enableTeamGeneration: true, enableVoting: true });
    expect(defaultEventSettings('Social')).toEqual({ enableTeamGeneration: false, enableVoting: false });
    expect(defaultEventSettings('Tournament')).toEqual({ enableTeamGeneration: true, enableVoting: true });
  });

  it('validates required event fields', () => {
    expect(validateEventInput(validEvent)).toEqual({});
    expect(
      validateEventInput({
        ...validEvent,
        title: '',
        location: '',
        eventDate: '',
        startTime: '',
        rsvpDeadline: '',
        numberOfTeams: 5,
      }),
    ).toEqual({
      title: 'Title is required.',
      location: 'Location is required.',
      eventDate: 'Date is required.',
      startTime: 'Start time is required.',
      rsvpDeadline: 'RSVP deadline is required.',
      numberOfTeams: 'Choose 2, 3, or 4 teams.',
    });
  });

  it('keeps late-arrival data tied to Going RSVP', () => {
    expect(validateRsvpInput({ eventId: 'event-1', rsvpStatus: 'Going', isArrivingLate: true, expectedArrivalTime: '19:30' })).toBeNull();
    expect(validateRsvpInput({ eventId: 'event-1', rsvpStatus: 'Maybe', isArrivingLate: true, expectedArrivalTime: '' })).toBe('Late arrival is only available when RSVP is Going.');
    expect(validateRsvpInput({ eventId: 'event-1', rsvpStatus: 'Going', isArrivingLate: false, expectedArrivalTime: '19:30' })).toBe('Expected arrival time requires late arrival.');
  });

  it('formats event date labels for compact mobile display', () => {
    expect(formatEventDate('2026-07-03', '19:00:00')).toContain('Jul');
  });

  it('keeps today and future events while hiding past events', () => {
    expect(isUpcomingEventDate('2026-07-03', '2026-07-04')).toBe(false);
    expect(isUpcomingEventDate('2026-07-04', '2026-07-04')).toBe(true);
    expect(isUpcomingEventDate('2026-07-09', '2026-07-04')).toBe(true);
  });

  it('filters event summaries to upcoming dates', () => {
    const baseEvent: EventSummary = {
      id: 'event-1',
      title: 'Practice',
      event_type: 'Football',
      event_date: '2026-07-02',
      start_time: '19:00:00',
      location: 'Hafnia Hallen',
      rsvp_deadline: '2026-07-02T18:00:00Z',
      status: 'Open',
      my_rsvp_status: null,
      going_count: 0,
      maybe_count: 0,
      not_going_count: 0,
      late_count: 0,
    };

    expect(
      filterUpcomingEvents(
        [
          baseEvent,
          { ...baseEvent, id: 'event-2', event_date: '2026-07-04' },
          { ...baseEvent, id: 'event-3', event_date: '2026-07-09' },
        ],
        '2026-07-04',
      ).map((event) => event.id),
    ).toEqual(['event-2', 'event-3']);
  });

  it('validates event guest names against current participants', () => {
    const input = createDefaultGuestInput('event-1');
    expect(validateEventGuestInput({ ...input, firstName: 'Ken' }, [])).toEqual({});
    expect(validateEventGuestInput({ ...input, firstName: ' Ken ' }, [{ first_name: 'ken' }])).toEqual({
      firstName: 'This name is already used by a participant in this event.',
    });
  });

  it('requires duplicated events to use a new date', () => {
    expect(validateDuplicateInput({ eventId: 'event-1', eventDate: '' }, '2026-07-03')).toBe('New date is required.');
    expect(validateDuplicateInput({ eventId: 'event-1', eventDate: '2026-07-03' }, '2026-07-03')).toBe('Choose a new date for the duplicated event.');
    expect(validateDuplicateInput({ eventId: 'event-1', eventDate: '2026-07-10' }, '2026-07-03')).toBeNull();
  });
});
