export const eventTypes = ['Football', 'Tournament', 'Social', 'Other'] as const;
export const eventStatuses = ['Draft', 'Open', 'Attendance confirmed', 'Teams confirmed', 'Voting open', 'Completed', 'Cancelled'] as const;
export const rsvpStatuses = ['Going', 'Maybe', 'Not going'] as const;

export type EventType = (typeof eventTypes)[number];
export type EventStatus = (typeof eventStatuses)[number];
export type RsvpStatus = (typeof rsvpStatuses)[number];

export type EventSummary = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  start_time: string;
  location: string;
  rsvp_deadline: string;
  status: EventStatus;
  my_rsvp_status: RsvpStatus | null;
  going_count: number;
  maybe_count: number;
  not_going_count: number;
  late_count: number;
};

export type EventRecord = {
  id: string;
  team_id: string;
  season_id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  start_time: string;
  location: string;
  rsvp_deadline: string;
  number_of_teams: number;
  notes: string | null;
  enable_team_generation: boolean;
  enable_voting: boolean;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MyRsvp = {
  id: string;
  event_id: string;
  member_id: string;
  rsvp_status: RsvpStatus;
  is_arriving_late: boolean;
  expected_arrival_time: string | null;
  responded_at: string;
  updated_at: string;
  was_updated_after_deadline: boolean;
};

export type EventDetail = {
  event: EventRecord;
  myRsvp: MyRsvp | null;
  counts: {
    going: number;
    maybe: number;
    notGoing: number;
    late: number;
  };
};

export type EventCreateInput = {
  title: string;
  eventType: EventType;
  eventDate: string;
  startTime: string;
  location: string;
  rsvpDeadline: string;
  numberOfTeams: number;
  notes: string;
  enableTeamGeneration: boolean;
  enableVoting: boolean;
  status: EventStatus;
};

export type RsvpInput = {
  eventId: string;
  rsvpStatus: RsvpStatus;
  isArrivingLate: boolean;
  expectedArrivalTime: string;
};

export function defaultEventSettings(eventType: EventType) {
  if (eventType === 'Football') {
    return { enableTeamGeneration: true, enableVoting: true };
  }

  if (eventType === 'Social') {
    return { enableTeamGeneration: false, enableVoting: false };
  }

  return { enableTeamGeneration: true, enableVoting: true };
}

export function validateEventInput(input: EventCreateInput) {
  const errors: Partial<Record<keyof EventCreateInput, string>> = {};

  if (!input.title.trim()) errors.title = 'Title is required.';
  if (!input.location.trim()) errors.location = 'Location is required.';
  if (!input.eventDate) errors.eventDate = 'Date is required.';
  if (!input.startTime) errors.startTime = 'Start time is required.';
  if (!input.rsvpDeadline) errors.rsvpDeadline = 'RSVP deadline is required.';
  if (![2, 3, 4].includes(input.numberOfTeams)) errors.numberOfTeams = 'Choose 2, 3, or 4 teams.';

  return errors;
}

export function validateRsvpInput(input: RsvpInput) {
  if (input.rsvpStatus !== 'Going' && (input.isArrivingLate || input.expectedArrivalTime)) {
    return 'Late arrival is only available when RSVP is Going.';
  }

  if (!input.isArrivingLate && input.expectedArrivalTime) {
    return 'Expected arrival time requires late arrival.';
  }

  return null;
}

export function formatEventDate(date: string, startTime: string) {
  const eventDate = new Date(`${date}T${startTime}`);
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(eventDate);
}
