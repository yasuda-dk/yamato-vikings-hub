export function attendanceRankingRequest(body: Record<string, unknown>) {
  if (typeof body.teamId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.teamId)) throw new Error('Team is required');
  if (body.year !== null && (!Number.isInteger(body.year) || Number(body.year) < 2020 || Number(body.year) > 2200)) throw new Error('Invalid year');
  return { target_team_id: body.teamId, target_year: body.year };
}
