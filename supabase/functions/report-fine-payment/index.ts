import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.teamId !== 'string') {
      return jsonResponse({ ok: false, error: 'Team is required' }, 400);
    }

    if (!Array.isArray(body.fineIds) || body.fineIds.some((fineId: unknown) => typeof fineId !== 'string')) {
      return jsonResponse({ ok: false, error: 'Select at least one fine' }, 400);
    }

    const { data, error } = await supabase.rpc('report_fine_payment', {
      target_team_id: body.teamId,
      p_fine_ids: body.fineIds,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, fineBox: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
