import { normalizeFirstName } from './member-options';
import type { Phase1Api, SessionState } from './phase1-api';
import type { AnnualAwardsResults, AwardSurvey, AwardVote } from './annual-awards';

export function createDemoAnnualAwards(getSession: () => SessionState): Pick<Phase1Api, 'getAnnualAwards' | 'saveAnnualAwardVote' | 'manageAnnualAwards' | 'getAnnualAwardResults'> {
  const surveys = new Map<number, AwardSurvey>([[2026, { id: 'demo-annual-2026', year: 2026, deadline: '2026-11-28T17:00:00Z', status: 'Open', canVote: true }]]);
  let votes: (AwardVote & { surveyId: string; voterId: string; updatedAt: string })[] = [];
  let reviewerId: string | null = null;
  function session() {
    const state = getSession();
    if (!state.hasAccess || !state.selectedMember) throw new Error('Approved member profile required');
    reviewerId ??= state.members.find((member) => normalizeFirstName(member.first_name) === 'takashi')?.id ?? null;
    const canManage = state.selectedMember.id === reviewerId && normalizeFirstName(state.selectedMember.first_name) === 'takashi';
    return { ...state, selectedMember: state.selectedMember, canManage };
  }
  return {
    async getAnnualAwards(year) {
      const state = session();
      const saved = surveys.get(year);
      const isOpen = Boolean(saved?.status === 'Open' && Date.now() < new Date(saved.deadline).getTime());
      return {
        canManage: state.canManage,
        years: [...surveys.keys()].sort((a, b) => b - a),
        survey: saved ? { ...saved, status: isOpen ? 'Open' : 'Closed', canVote: isOpen && state.selectedMember.membership_status === 'Active' } : null,
        candidates: state.members.map(({ id, first_name, membership_status }) => ({ id, first_name, membership_status })),
        ownVotes: votes.filter((vote) => vote.surveyId === saved?.id && vote.voterId === state.selectedMember.id).map(({ award, candidateId, comment }) => ({ award, candidateId, comment })),
      };
    },
    async saveAnnualAwardVote(surveyId, vote) {
      const state = session();
      const survey = [...surveys.values()].find((value) => value.id === surveyId);
      if (!survey || survey.status !== 'Open' || Date.now() >= new Date(survey.deadline).getTime()) throw new Error('Voting is closed');
      if (state.selectedMember.membership_status !== 'Active') throw new Error('Active member profile required');
      if (!vote.comment.trim() || [...vote.comment.trim()].length > 1000) throw new Error('Comment must be between 1 and 1000 characters');
      if (!state.members.some((member) => member.id === vote.candidateId && member.membership_status === 'Active')) throw new Error('Choose an active team member');
      votes = votes.filter((saved) => !(saved.surveyId === surveyId && saved.voterId === state.selectedMember.id && saved.award === vote.award));
      votes.push({ ...vote, comment: vote.comment.trim(), surveyId, voterId: state.selectedMember.id, updatedAt: new Date().toISOString() });
    },
    async manageAnnualAwards(input) {
      const state = session();
      if (!state.canManage) throw new Error('Only Takashi can manage annual awards');
      const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Copenhagen', timeZoneName: 'longOffset' }).formatToParts(new Date(`${input.deadlineLocal}Z`)).find((part) => part.type === 'timeZoneName')!.value.replace('GMT', '');
      const deadline = new Date(`${input.deadlineLocal}${offset}`).toISOString();
      if (input.status === 'Open' && new Date(deadline).getTime() <= Date.now()) throw new Error('Open surveys need a future deadline');
      surveys.set(input.year, { id: `demo-annual-${input.year}`, year: input.year, deadline, status: input.status, canVote: input.status === 'Open' });
    },
    async getAnnualAwardResults(surveyId) {
      const state = session();
      if (!state.canManage) throw new Error('Only Takashi can view annual award results');
      const saved = votes.filter((vote) => vote.surveyId === surveyId);
      const rankings: AnnualAwardsResults['rankings'] = [];
      for (const award of ['MGP', 'MOP'] as const) {
        const counts = new Map<string, number>();
        saved.filter((vote) => vote.award === award).forEach((vote) => counts.set(vote.candidateId, (counts.get(vote.candidateId) ?? 0) + 1));
        let lastCount = -1;
        let rank = 0;
        [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).forEach(([candidateId, count], index) => {
          if (count !== lastCount) rank = index + 1;
          lastCount = count;
          rankings.push({ award, candidateId, votes: count, rank, first_name: state.members.find((member) => member.id === candidateId)?.first_name ?? 'Inactive member' });
        });
      }
      return { rankings, responseCount: new Set(saved.map((vote) => vote.voterId)).size, comments: saved.map((vote) => ({ award: vote.award, candidateId: vote.candidateId, comment: vote.comment, updatedAt: vote.updatedAt, voter: state.members.find((member) => member.id === vote.voterId)?.first_name ?? 'Inactive member' })) };
    },
  };
}
