import type { Session } from '@supabase/supabase-js';
import type { MemberProfile, MemberRegistrationInput } from './member-options';
import type { Phase1Api, SessionState } from './phase1-api';

const demoSession = { access_token: 'demo' } as Session;

let state: SessionState = {
  hasAccess: false,
  selectedMember: null,
  members: [],
};

function toMember(input: MemberRegistrationInput): MemberProfile {
  return {
    id: crypto.randomUUID(),
    first_name: input.firstName.trim().replace(/\s+/g, ' '),
    age_group: input.ageGroup,
    football_level: input.footballLevel,
    primary_position: input.primaryPosition,
    secondary_position: input.secondaryPosition === 'None' ? null : input.secondaryPosition,
    residence_type: input.residenceType,
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
};
