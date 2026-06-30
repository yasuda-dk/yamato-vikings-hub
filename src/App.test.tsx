import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
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
  membership_status: 'Active',
  application_role: 'Player',
  created_at: '2026-01-01T00:00:00.000Z',
};

function createApi(initialState: SessionState): Phase1Api {
  let state = initialState;
  return {
    ensureAnonymousSession: async () => null,
    getSessionState: async () => state,
    verifyTeamPassword: async (password) => {
      if (password !== 'demo') throw new Error('Incorrect team password');
      state = { ...state, hasAccess: true };
    },
    registerMember: async (input) => {
      const member = { ...takashi, id: 'member-new', first_name: input.firstName };
      state = { hasAccess: true, selectedMember: member, members: [member] };
    },
    selectProfile: async (memberId) => {
      state = { ...state, selectedMember: state.members.find((member) => member.id === memberId) ?? null };
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
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();

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
