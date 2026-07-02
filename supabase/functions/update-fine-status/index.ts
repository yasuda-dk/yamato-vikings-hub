import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const actions = ['confirm-paid', 'waive'];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.teamId !== 'string') {
      return jsonResponse({ ok: false, error: 'Team is required' }, 400);
    }

    if (typeof body.fineId !== 'string') {
      return jsonResponse({ ok: false, error: 'Fine is required' }, 400);
    }

    if (!actions.includes(body.action)) {
      return jsonResponse({ ok: false, error: 'Unsupported fine action' }, 400);
    }

    const { data, error } = await supabase.rpc('update_fine_status', {
      target_team_id: body.teamId,
      p_fine_id: body.fineId,
      p_action: body.action,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, fineBox: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
