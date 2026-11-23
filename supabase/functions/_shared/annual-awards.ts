type Body = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function awardRequest(body: Body) {
  if (typeof body.teamId !== 'string' || !uuid.test(body.teamId)) throw new Error('Team is required');
  const args: Record<string, unknown> = { target_team_id: body.teamId };
  if (body.action === 'state' || body.action === 'manage') {
    if (!Number.isInteger(body.year) || Number(body.year) < 2020 || Number(body.year) > 2200) throw new Error('Invalid award year');
    args.target_year = body.year;
    if (body.action === 'state') return { rpc: 'club_awards_state', args, field: 'state' };
    if (typeof body.deadlineLocal !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.deadlineLocal)) throw new Error('Deadline is required');
    if (body.status !== 'Open' && body.status !== 'Closed') throw new Error('Invalid survey status');
    return { rpc: 'manage_club_award_survey', args: { ...args, p_deadline_local: body.deadlineLocal, p_status: body.status }, field: 'surveyId' };
  }
  if (typeof body.surveyId !== 'string' || !uuid.test(body.surveyId)) throw new Error('Survey is required');
  args.target_survey_id = body.surveyId;
  if (body.action === 'results') return { rpc: 'club_awards_results', args, field: 'results' };
  if (body.action !== 'vote') throw new Error('Invalid annual awards action');
  if (body.award !== 'MGP' && body.award !== 'MOP') throw new Error('Award is required');
  if (typeof body.candidateId !== 'string' || !uuid.test(body.candidateId)) throw new Error('Candidate is required');
  if (typeof body.comment !== 'string' || !body.comment.trim() || [...body.comment.trim()].length > 1000) throw new Error('Comment must be between 1 and 1000 characters');
  return { rpc: 'save_club_award_vote', args: { ...args, p_award: body.award, p_candidate_id: body.candidateId, p_comment: body.comment.trim() }, field: 'saved' };
}
