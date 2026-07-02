import {
  ageGroups,
  footballLevels,
  genders,
  isAgeGroup,
  isFootballLevel,
  isGender,
  isPosition,
  isResidenceType,
  normalizeFirstName,
  positions,
  residenceTypes,
  type AgeGroup,
  type FootballLevel,
  type Gender,
  type Position,
  type ResidenceType,
  type SecondaryPosition,
} from './member-options';

export const eventTypes = ['Football', 'Tournament', 'Social', 'Other'] as const;
export const eventStatuses = ['Draft', 'Open', 'Attendance confirmed', 'Teams confirmed', 'Voting open', 'Completed', 'Cancelled'] as const;
export const rsvpStatuses = ['Going', 'Maybe', 'Not going'] as const;
export const actualStatuses = ['Not confirmed', 'Attended', 'Absent'] as const;

export type EventType = (typeof eventTypes)[number];
export type EventStatus = (typeof eventStatuses)[number];
export type RsvpStatus = (typeof rsvpStatuses)[number];
export type ActualStatus = (typeof actualStatuses)[number];

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

export type EventGuest = {
  id: string;
  event_id: string;
  first_name: string;
  first_name_normalized: string;
  age_group: AgeGroup;
  football_level: FootballLevel;
  primary_position: Position;
  secondary_position: Position | null;
  residence_type: ResidenceType;
  gender: Gender;
  actual_status: ActualStatus;
  created_by: string | null;
  created_at: string;
};

export type EventParticipant = {
  kind: 'member' | 'guest';
  id: string;
  first_name: string;
  rsvp_status: RsvpStatus | null;
  is_arriving_late: boolean;
  expected_arrival_time: string | null;
  actual_status: ActualStatus;
  football_level: FootballLevel;
  primary_position: Position;
  secondary_position: Position | null;
  age_group: AgeGroup;
};

export type EventTeamParticipant = {
  kind: 'member' | 'guest';
  id: string;
  first_name: string;
  football_level: FootballLevel;
  primary_position: Position;
  secondary_position: Position | null;
  age_group: AgeGroup;
  is_locked: boolean;
};

export type EventTeam = {
  id: string;
  event_id: string;
  name: string;
  display_order: number;
  is_confirmed: boolean;
  balance_score: number | null;
  score_breakdown: Record<string, number> | null;
  participants: EventTeamParticipant[];
};

export type EventDetail = {
  event: EventRecord;
  myRsvp: MyRsvp | null;
  counts: {
    going: number;
    maybe: number;
    notGoing: number;
    late: number;
    attended: number;
    guests: number;
  };
  participants: EventParticipant[];
  guests: EventGuest[];
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

export type EventUpdateInput = EventCreateInput & {
  eventId: string;
};

export type EventDuplicateInput = {
  eventId: string;
  eventDate: string;
};

export type RsvpInput = {
  eventId: string;
  rsvpStatus: RsvpStatus;
  isArrivingLate: boolean;
  expectedArrivalTime: string;
};

export type EventGuestInput = {
  eventId: string;
  firstName: string;
  ageGroup: AgeGroup;
  footballLevel: FootballLevel;
  primaryPosition: Position;
  secondaryPosition: SecondaryPosition;
  residenceType: ResidenceType;
  gender: Gender;
};

export type AttendanceInput = {
  eventId: string;
  memberId: string;
  actualStatus: ActualStatus;
};

export type GuestAttendanceInput = {
  eventGuestId: string;
  actualStatus: ActualStatus;
};

export type GenerateTeamsInput = {
  eventId: string;
  teamCount: 2 | 3 | 4;
  attemptNumber: number;
  preserveLocked?: boolean;
};

export type TeamAdjustmentInput =
  | {
      action: 'move-participant';
      eventId: string;
      participantKind: 'member' | 'guest';
      participantId: string;
      targetTeamId: string;
    }
  | {
      action: 'remove-participant';
      eventId: string;
      participantKind: 'member' | 'guest';
      participantId: string;
    }
  | {
      action: 'swap-participants';
      eventId: string;
      participantKind: 'member' | 'guest';
      participantId: string;
      swapParticipantKind: 'member' | 'guest';
      swapParticipantId: string;
    }
  | {
      action: 'toggle-lock';
      eventId: string;
      participantKind: 'member' | 'guest';
      participantId: string;
      isLocked: boolean;
    }
  | {
      action: 'rename-team';
      eventId: string;
      teamId: string;
      name: string;
    }
  | {
      action: 'confirm-teams';
      eventId: string;
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

export function validateDuplicateInput(input: EventDuplicateInput, sourceDate: string) {
  if (!input.eventDate) return 'New date is required.';
  if (input.eventDate === sourceDate) return 'Choose a new date for the duplicated event.';
  return null;
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

export function validateEventGuestInput(input: EventGuestInput, participants: Pick<EventParticipant, 'first_name'>[]) {
  const errors: Partial<Record<keyof EventGuestInput, string>> = {};
  const normalizedName = normalizeFirstName(input.firstName);

  if (!normalizedName) {
    errors.firstName = 'First name is required.';
  } else if (participants.some((participant) => normalizeFirstName(participant.first_name) === normalizedName)) {
    errors.firstName = 'This name is already used by a participant in this event.';
  }

  if (!isAgeGroup(input.ageGroup)) errors.ageGroup = 'Select an age group.';
  if (!isFootballLevel(input.footballLevel)) errors.footballLevel = 'Select a football level.';
  if (!isPosition(input.primaryPosition)) errors.primaryPosition = 'Select a primary position.';
  if (input.secondaryPosition !== 'None' && !isPosition(input.secondaryPosition)) {
    errors.secondaryPosition = 'Select a secondary position.';
  }
  if (input.secondaryPosition !== 'None' && input.secondaryPosition === input.primaryPosition) {
    errors.secondaryPosition = 'Secondary position must be different from primary position.';
  }
  if (!isResidenceType(input.residenceType)) errors.residenceType = 'Select a residence type.';
  if (!isGender(input.gender)) errors.gender = 'Select a gender.';

  return errors;
}

export function createDefaultGuestInput(eventId: string): EventGuestInput {
  return {
    eventId,
    firstName: '',
    ageGroup: ageGroups[ageGroups.length - 1],
    footballLevel: footballLevels[2],
    primaryPosition: positions[1],
    secondaryPosition: 'None',
    residenceType: residenceTypes[residenceTypes.length - 1],
    gender: genders[genders.length - 1],
  };
}

export function eventRecordToInput(event: EventRecord): EventCreateInput {
  return {
    title: event.title,
    eventType: event.event_type,
    eventDate: event.event_date,
    startTime: event.start_time.slice(0, 5),
    location: event.location,
    rsvpDeadline: event.rsvp_deadline.slice(0, 16),
    numberOfTeams: event.number_of_teams,
    notes: event.notes ?? '',
    enableTeamGeneration: event.enable_team_generation,
    enableVoting: event.enable_voting,
    status: event.status,
  };
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
