import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { MemberProfile } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';
import type { AnnualAwardsState } from '../lib/annual-awards';
import { AnnualAwardsPage } from './AnnualAwardsPage';

const member = { id: 'self', application_role: 'Admin' } as MemberProfile;
const baseState: AnnualAwardsState = {
  canManage: false, years: [2026],
  survey: { id: 'survey', year: 2026, deadline: '2099-11-28T17:00:00Z', status: 'Open', canVote: true },
  candidates: [{ id: 'self', first_name: 'Me', membership_status: 'Active' }, { id: 'other', first_name: 'Friend', membership_status: 'Active' }],
  ownVotes: [],
};
function apiFor(state = baseState) {
  return {
    getAnnualAwards: vi.fn().mockResolvedValue(state),
    saveAnnualAwardVote: vi.fn().mockResolvedValue(undefined),
    manageAnnualAwards: vi.fn().mockResolvedValue(undefined),
    getAnnualAwardResults: vi.fn().mockResolvedValue({ responseCount: 1, rankings: [{ award: 'MGP', candidateId: 'other', first_name: 'Friend', rank: 1, votes: 1 }], comments: [{ award: 'MGP', candidateId: 'other', voter: 'Me', comment: 'Private feedback', updatedAt: '2026-11-23' }] }),
  };
}
function show(api: ReturnType<typeof apiFor>, profile = member) {
  return render(<MemoryRouter><AnnualAwardsPage api={api as unknown as Phase1Api} selectedMember={profile} /></MemoryRouter>);
}

describe('Annual Awards', () => {
  it('allows former inactive members as nominees for both awards', async () => {
    const api = apiFor({ ...baseState, candidates: [...baseState.candidates, { id: 'former', first_name: 'Former', membership_status: 'Inactive' }] });
    const user = userEvent.setup(); show(api);
    await screen.findByLabelText('MGP nominee');
    for (const award of ['MGP', 'MOP']) {
      await user.selectOptions(screen.getByLabelText(`${award} nominee`), 'former');
      expect(screen.getByLabelText(`${award} nominee`)).toHaveValue('former');
      await user.type(screen.getByLabelText(`${award} comment`), 'Contributed throughout the year');
      await user.click(screen.getByRole('button', { name: `Submit ${award} vote` }));
      expect(await screen.findByText(`${award} vote saved.`)).toBeInTheDocument();
      expect(api.saveAnnualAwardVote).toHaveBeenCalledWith('survey', { award, candidateId: 'former', comment: 'Contributed throughout the year' });
    }
  });

  it('accepts a self-nomination with a required comment but never fetches results for another Admin', async () => {
    const api = apiFor(); const user = userEvent.setup(); show(api);
    const nominee = await screen.findByLabelText('MGP nominee');
    expect(screen.getByRole('button', { name: 'Submit MGP vote' })).toBeDisabled();
    await user.selectOptions(nominee, 'self');
    await user.type(screen.getByLabelText('MGP comment'), 'Kept trying all year');
    await user.click(screen.getByRole('button', { name: 'Submit MGP vote' }));
    expect(await screen.findByText('MGP vote saved.')).toBeInTheDocument();
    expect(api.saveAnnualAwardVote).toHaveBeenCalledWith('survey', { award: 'MGP', candidateId: 'self', comment: 'Kept trying all year' });
    expect(api.getAnnualAwardResults).not.toHaveBeenCalled();
    expect(screen.queryByRole('tab', { name: 'Results' })).not.toBeInTheDocument();
    expect(screen.queryByText('Voting settings')).not.toBeInTheDocument();
  });

  it('loads existing choices and lets a member update a vote', async () => {
    const api = apiFor({ ...baseState, ownVotes: [{ award: 'MOP', candidateId: 'other', comment: 'Bought dinner' }] });
    const user = userEvent.setup(); show(api);
    expect(await screen.findByLabelText('MOP nominee')).toHaveValue('other');
    expect(screen.getByLabelText('MOP comment')).toHaveValue('Bought dinner');
    await user.selectOptions(screen.getByLabelText('MOP nominee'), 'self');
    await user.click(screen.getByRole('button', { name: 'Update MOP vote' }));
    expect(await screen.findByText('MOP vote saved.')).toBeInTheDocument();
  });

  it('only fetches private rankings when Takashi opens Results and clears them on profile change', async () => {
    const api = apiFor({ ...baseState, canManage: true }); const user = userEvent.setup(); const view = show(api);
    await screen.findByRole('tab', { name: 'Results' });
    expect(api.getAnnualAwardResults).not.toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: 'Results' }));
    expect(await screen.findByText('Private feedback')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MGP ranking' })).toBeInTheDocument();
    api.getAnnualAwards.mockResolvedValue(baseState);
    view.rerender(<MemoryRouter><AnnualAwardsPage api={api as unknown as Phase1Api} selectedMember={{ ...member, id: 'different' }} /></MemoryRouter>);
    expect(screen.queryByText('Private feedback')).not.toBeInTheDocument();
    await screen.findByLabelText('MGP nominee');
    expect(screen.queryByRole('tab', { name: 'Results' })).not.toBeInTheDocument();
  });

  it('shows saved votes as read-only when voting is closed', async () => {
    show(apiFor({ ...baseState, survey: { ...baseState.survey!, status: 'Closed', canVote: false } }));
    expect(await screen.findByLabelText('MGP nominee')).toBeDisabled();
    expect(screen.getByLabelText('MOP comment')).toBeDisabled();
    expect(screen.getByText('Voting closed')).toBeInTheDocument();
  });

  it('keeps the comment and offers recovery after a vote save error', async () => {
    const api = apiFor(); api.saveAnnualAwardVote.mockRejectedValueOnce(new Error('Voting is closed'));
    const user = userEvent.setup(); show(api);
    await user.selectOptions(await screen.findByLabelText('MGP nominee'), 'other');
    await user.type(screen.getByLabelText('MGP comment'), 'Helped everyone');
    await user.click(screen.getByRole('button', { name: 'Submit MGP vote' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Voting is closed');
    expect(screen.getByLabelText('MGP comment')).toHaveValue('Helped everyone');
  });

  it('recovers from a loading error', async () => {
    const api = apiFor(); api.getAnnualAwards.mockRejectedValueOnce(new Error('Connection lost')); show(api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry awards' }));
    expect(await screen.findByLabelText('MGP nominee')).toBeInTheDocument();
  });

  it('lets Takashi open an annual round with the configured Copenhagen deadline', async () => {
    const api = apiFor({ ...baseState, canManage: true, survey: null }); const user = userEvent.setup(); show(api);
    const field = await screen.findByLabelText('Deadline (Copenhagen)');
    expect(field).toHaveValue('2026-11-28T18:00');
    await user.click(screen.getByRole('button', { name: 'Open annual voting' }));
    expect(api.manageAnnualAwards).toHaveBeenCalledWith({ year: 2026, deadlineLocal: '2026-11-28T18:00', status: 'Open' });
  });
});
