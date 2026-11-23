import { attendanceRankingRequest } from './attendance-ranking.ts';
const teamId = '00000000-0000-0000-0000-000000000001';
Deno.test('attendance ranking accepts a year or all time without trusting client permissions', () => {
  const args = attendanceRankingRequest({ teamId, year: null, canManage: true, memberId: 'spoof' });
  if (args.target_year !== null || Object.keys(args).length !== 2) throw new Error('Unsafe ranking arguments');
  if (attendanceRankingRequest({ teamId, year: 2026 }).target_year !== 2026) throw new Error('Year changed');
});
Deno.test('attendance ranking rejects invalid requests', () => {
  for (const body of [{ teamId, year: '2026' }, { teamId, year: 1 }, { teamId, year: 2026.5 }, { teamId: 'invalid', year: null }, { teamId }]) {
    let rejected = false;
    try { attendanceRankingRequest(body); } catch { rejected = true; }
    if (!rejected) throw new Error('Invalid ranking request accepted');
  }
});
