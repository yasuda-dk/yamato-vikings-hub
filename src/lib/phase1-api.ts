import type { Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from './supabase';
import { DEFAULT_TEAM_ID, type MemberProfile, type MemberRegistrationInput } from './member-options';

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
  selectProfile: (memberId: string) => Promise<void>;
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
    throw new Error(error.message);
  }

  if (data?.ok === false) {
    throw new Error(data.error ?? 'Request failed');
  }

  return data as T;
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

  async selectProfile(memberId: string) {
    await invokeFunction('select-profile', { memberId });
  },
};
