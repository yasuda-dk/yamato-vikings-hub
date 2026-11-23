import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
import { attendanceRankingRequest } from '../_shared/attendance-ranking.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'POST is required' }, 405);
  try {
    const { supabase } = await requireUser(req);
    const { data, error } = await supabase.rpc('attendance_top_ten', attendanceRankingRequest(await req.json()));
    if (error) throw new Error(error.message);
    return jsonResponse({ ok: true, ranking: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Could not load attendance ranking' }, 400);
  }
});
