import { describe, expect, it } from 'vitest';
import { createDefaultGuestInput, defaultEventSettings, formatEventDate, validateEventGuestInput, validateEventInput, validateRsvpInput, type EventCreateInput } from './events';

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

  it('validates event guest names against current participants', () => {
    const input = createDefaultGuestInput('event-1');
    expect(validateEventGuestInput({ ...input, firstName: 'Ken' }, [])).toEqual({});
    expect(validateEventGuestInput({ ...input, firstName: ' Ken ' }, [{ first_name: 'ken' }])).toEqual({
      firstName: 'This name is already used by a participant in this event.',
    });
  });
});
