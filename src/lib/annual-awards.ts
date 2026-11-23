export const awardTypes = ['MGP', 'MOP'] as const;
export type AwardType = (typeof awardTypes)[number];
export const awardLabels: Record<AwardType, { title: string; description: string }> = {
  MGP: { title: 'Most 頑張ったプレーヤー', description: 'Recognise effort and contribution, on and off the pitch.' },
  MOP: { title: 'Most 奢ったプレーヤー', description: 'Recognise the teammate who treated others most generously.' },
};
export type AwardSurvey = { id: string; year: number; deadline: string; status: 'Open' | 'Closed'; canVote: boolean };
export type AwardVote = { award: AwardType; candidateId: string; comment: string };
export type AwardCandidate = { id: string; first_name: string; membership_status: 'Active' | 'Inactive' };
export type AnnualAwardsState = {
  canManage: boolean;
  years: number[];
  survey: AwardSurvey | null;
  candidates: AwardCandidate[];
  ownVotes: AwardVote[];
};
export type AwardRanking = { award: AwardType; candidateId: string; first_name: string; votes: number; rank: number };
export type AwardComment = { award: AwardType; candidateId: string; voter: string; comment: string; updatedAt: string };
export type AnnualAwardsResults = { rankings: AwardRanking[]; comments: AwardComment[]; responseCount: number };
export type ManageAwardSurvey = { year: number; deadlineLocal: string; status: 'Open' | 'Closed' };

export function formatAwardDeadline(value: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

export function awardDeadlineInput(value: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(' ', 'T');
}
