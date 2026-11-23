import { awardRequest } from './annual-awards.ts';

const id = '00000000-0000-0000-0000-000000000001';
Deno.test('award routing uses authenticated team/profile context, not supplied voter or reviewer IDs', () => {
  const request = awardRequest({ action: 'vote', teamId: id, surveyId: id, candidateId: id, award: 'MGP', comment: ' Great effort ', voterId: 'spoof', canManage: true });
  if (request.rpc !== 'save_club_award_vote' || request.args.p_comment !== 'Great effort' || 'voterId' in request.args || 'canManage' in request.args) throw new Error('Unsafe vote routing');
});
Deno.test('award routing validates award types, years, comments, and actions', () => {
  for (const body of [
    { action: 'state', teamId: id, year: 1 },
    { action: 'vote', teamId: id, surveyId: id, candidateId: id, award: 'MVP', comment: 'Nice' },
    { action: 'vote', teamId: id, surveyId: id, candidateId: id, award: 'MOP', comment: ' ' },
    { action: 'vote', teamId: id, surveyId: id, candidateId: id, award: 'MOP', comment: 'x'.repeat(1001) },
    { action: 'delete', teamId: id, surveyId: id },
  ]) {
    let rejected = false;
    try { awardRequest(body); } catch { rejected = true; }
    if (!rejected) throw new Error('Invalid request accepted');
  }
});
Deno.test('award management keeps Copenhagen wall time and result routing separate', () => {
  const manage = awardRequest({ action: 'manage', teamId: id, year: 2026, deadlineLocal: '2026-11-28T18:00', status: 'Open' });
  if (manage.args.p_deadline_local !== '2026-11-28T18:00') throw new Error('Deadline changed');
  if (awardRequest({ action: 'results', teamId: id, surveyId: id }).rpc !== 'club_awards_results') throw new Error('Wrong result RPC');
});
