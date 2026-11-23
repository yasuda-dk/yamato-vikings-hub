import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoAnnualAwards } from './demo-annual-awards';
import type { MemberProfile } from './member-options';
import type { SessionState } from './phase1-api';

afterEach(() => vi.useRealTimers());

describe('demo annual award nominee eligibility', () => {
  it('lists and ranks inactive nominees without enabling inactive voters', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
    const owner = { id: 'owner', first_name: 'Takashi', membership_status: 'Active' } as MemberProfile;
    const former = { id: 'former', first_name: 'Former', membership_status: 'Inactive' } as MemberProfile;
    const state: SessionState = { hasAccess: true, selectedMember: owner, members: [owner, former] };
    const api = createDemoAnnualAwards(() => state);
    expect((await api.getAnnualAwards(2026)).candidates).toContainEqual(former);
    for (const award of ['MGP', 'MOP'] as const) {
      await api.saveAnnualAwardVote('demo-annual-2026', { award, candidateId: 'former', comment: 'A great teammate' });
    }
    const results = await api.getAnnualAwardResults('demo-annual-2026');
    expect(results.rankings).toHaveLength(2);
    expect(results.rankings.every((row) => row.candidateId === 'former' && row.votes === 1)).toBe(true);
    await expect(api.saveAnnualAwardVote('demo-annual-2026', { award: 'MGP', candidateId: 'outsider', comment: 'Wrong team' })).rejects.toThrow('Choose a team member');
    state.selectedMember = former;
    expect((await api.getAnnualAwards(2026)).survey?.canVote).toBe(false);
    await expect(api.saveAnnualAwardVote('demo-annual-2026', { award: 'MGP', candidateId: 'owner', comment: 'Inactive voter' })).rejects.toThrow('Active member profile required');
    await expect(api.getAnnualAwardResults('demo-annual-2026')).rejects.toThrow('Only Takashi');
  });
});
