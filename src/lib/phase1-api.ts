import type { Session } from '@supabase/supabase-js';
import type {
  AttendanceInput,
  EventCreateInput,
  EventDetail,
  EventDuplicateInput,
  EventGuestInput,
  EventSummary,
  EventTeam,
  EventVotingState,
  EventUpdateInput,
  GenerateTeamsInput,
  GuestAttendanceInput,
  OverrideAwardInput,
  RsvpInput,
  TeamAdjustmentInput,
  VoteInput,
  VotingStatusInput,
} from './events';
import type { CreateFineInput, CreateFinesInput, CreateFineTypeInput, FineBoxState, ReportFinePaymentInput, UpdateFineStatusInput, UpdateFineTypeInput } from './fines';
import { createSupabaseBrowserClient } from './supabase';
import { DEFAULT_TEAM_ID, type AdminMemberUpdateInput, type MemberProfile, type MemberRegistrationInput } from './member-options';

export type SessionState = {
  hasAccess: boolean;
  selectedMember: MemberProfile | null;
  members: MemberProfile[];
};

export type Phase1Api = {
  ensureAnonymousSession: () => Promise<Session | null>;
  getSessionState: () => Promise<SessionState>;
  verifyTeamPassword: (password: string) => Promise<void>;
  registerMember: (input: MemberRegistrationInput) => Promise<void>;
  updateMember: (input: AdminMemberUpdateInput) => Promise<void>;
  selectProfile: (memberId: string) => Promise<void>;
  listEvents: () => Promise<EventSummary[]>;
  listAnalyticsEvents: (seasonYear: number) => Promise<EventSummary[]>;
  getEventDetail: (eventId: string) => Promise<EventDetail>;
  createEvent: (input: EventCreateInput) => Promise<string>;
  updateEvent: (input: EventUpdateInput) => Promise<string>;
  duplicateEvent: (input: EventDuplicateInput) => Promise<string>;
  updateRsvp: (input: RsvpInput) => Promise<void>;
  createEventGuest: (input: EventGuestInput) => Promise<string>;
  updateAttendance: (input: AttendanceInput) => Promise<void>;
  updateGuestAttendance: (input: GuestAttendanceInput) => Promise<void>;
  getEventTeams: (eventId: string) => Promise<EventTeam[]>;
  generateTeams: (input: GenerateTeamsInput) => Promise<EventTeam[]>;
  adjustTeam: (input: TeamAdjustmentInput) => Promise<EventTeam[]>;
  getEventVoting: (eventId: string) => Promise<EventVotingState>;
  submitVote: (input: VoteInput) => Promise<EventVotingState>;
  setVotingStatus: (input: VotingStatusInput) => Promise<EventVotingState>;
  overrideAward: (input: OverrideAwardInput) => Promise<EventVotingState>;
  getFineBox: () => Promise<FineBoxState>;
  reportFinePayment: (input: ReportFinePaymentInput) => Promise<FineBoxState>;
  createFine: (input: CreateFineInput) => Promise<FineBoxState>;
  createFines: (input: CreateFinesInput) => Promise<FineBoxState>;
  updateFineStatus: (input: UpdateFineStatusInput) => Promise<FineBoxState>;
  createFineType: (input: CreateFineTypeInput) => Promise<FineBoxState>;
  updateFineType: (input: UpdateFineTypeInput) => Promise<FineBoxState>;
};

let supabaseClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function getSupabase() {
  supabaseClient ??= createSupabaseBrowserClient();
  return supabaseClient;
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>) {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke<T & { ok?: boolean; error?: string }>(name, {
    body: { teamId: DEFAULT_TEAM_ID, ...body },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, data));
  }

  if (data?.ok === false) {
    throw new Error(data.error ?? 'Request failed');
  }

  return data as T;
}

async function getFunctionErrorMessage(error: Error, data: { error?: string } | null) {
  if (data?.error) return data.error;

  const context = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Fall back to the Supabase client message below.
    }
  }

  return error.message;
}

export const phase1Api: Phase1Api = {
  async ensureAnonymousSession() {
    const supabase = getSupabase();
    const { data: current } = await supabase.auth.getSession();
    if (current.session) return current.session;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
    return data.session;
  },

  async getSessionState() {
    return invokeFunction<SessionState>('session-state', {});
  },

  async verifyTeamPassword(password: string) {
    await invokeFunction('verify-team-password', { password });
  },

  async registerMember(input: MemberRegistrationInput) {
    await invokeFunction('register-member', input);
  },

  async updateMember(input: AdminMemberUpdateInput) {
    await invokeFunction('update-member', input);
  },

  async selectProfile(memberId: string) {
    await invokeFunction('select-profile', { memberId });
  },

  async listEvents() {
    const data = await invokeFunction<{ events: EventSummary[] }>('events-list', {});
    return data.events;
  },

  async listAnalyticsEvents(seasonYear: number) {
    const data = await invokeFunction<{ events: EventSummary[] }>('analytics-events-list', { seasonYear });
    return data.events;
  },

  async getEventDetail(eventId: string) {
    const data = await invokeFunction<{ detail: EventDetail }>('event-detail', { eventId });
    return data.detail;
  },

  async createEvent(input: EventCreateInput) {
    const data = await invokeFunction<{ eventId: string }>('create-event', input);
    return data.eventId;
  },

  async updateEvent(input: EventUpdateInput) {
    const data = await invokeFunction<{ eventId: string }>('update-event', input);
    return data.eventId;
  },

  async duplicateEvent(input: EventDuplicateInput) {
    const data = await invokeFunction<{ eventId: string }>('duplicate-event', input);
    return data.eventId;
  },

  async updateRsvp(input: RsvpInput) {
    await invokeFunction('update-rsvp', input);
  },

  async createEventGuest(input: EventGuestInput) {
    const data = await invokeFunction<{ eventGuestId: string }>('create-event-guest', input);
    return data.eventGuestId;
  },

  async updateAttendance(input: AttendanceInput) {
    await invokeFunction('update-attendance', input);
  },

  async updateGuestAttendance(input: GuestAttendanceInput) {
    await invokeFunction('update-guest-attendance', input);
  },

  async getEventTeams(eventId: string) {
    const data = await invokeFunction<{ teams: EventTeam[] }>('get-event-teams', { eventId });
    return data.teams;
  },

  async generateTeams(input: GenerateTeamsInput) {
    const data = await invokeFunction<{ teams: EventTeam[] }>('generate-teams', input);
    return data.teams;
  },

  async adjustTeam(input: TeamAdjustmentInput) {
    const data = await invokeFunction<{ teams: EventTeam[] }>('adjust-team', input);
    return data.teams;
  },

  async getEventVoting(eventId: string) {
    const data = await invokeFunction<{ voting: EventVotingState }>('event-voting', { eventId });
    return data.voting;
  },

  async submitVote(input: VoteInput) {
    const data = await invokeFunction<{ voting: EventVotingState }>('submit-vote', input);
    return data.voting;
  },

  async setVotingStatus(input: VotingStatusInput) {
    const data = await invokeFunction<{ voting: EventVotingState }>('set-voting-status', input);
    return data.voting;
  },

  async overrideAward(input: OverrideAwardInput) {
    const data = await invokeFunction<{ voting: EventVotingState }>('override-award', input);
    return data.voting;
  },

  async getFineBox() {
    const data = await invokeFunction<{ fineBox: FineBoxState }>('fine-box', {});
    return data.fineBox;
  },

  async reportFinePayment(input: ReportFinePaymentInput) {
    const data = await invokeFunction<{ fineBox: FineBoxState }>('report-fine-payment', input);
    return data.fineBox;
  },

  async createFine(input: CreateFineInput) {
    const data = await invokeFunction<{ fineBox: FineBoxState }>('create-fine', input);
    return data.fineBox;
  },

  async createFines(input: CreateFinesInput) {
    const data = await invokeFunction<{ fineBox: FineBoxState }>('create-fines-batch', input);
    return data.fineBox;
  },

  async updateFineStatus(input: UpdateFineStatusInput) {
    const data = await invokeFunction<{ fineBox: FineBoxState }>('update-fine-status', input);
    return data.fineBox;
  },

  async createFineType(input: CreateFineTypeInput) {
    const data = await invokeFunction<{ fineBox: FineBoxState }>('create-fine-type', input);
    return data.fineBox;
  },

  async updateFineType(input: UpdateFineTypeInput) {
    const data = await invokeFunction<{ fineBox: FineBoxState }>('update-fine-type', input);
    return data.fineBox;
  },
};
