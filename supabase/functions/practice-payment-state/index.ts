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

    const isHistory = body.section === 'history';
    const { data, error } = await supabase.rpc(
      isHistory ? 'get_practice_payment_history' : 'get_practice_payment_state',
      {
        target_team_id: body.teamId,
        ...(!isHistory && body.section === 'current' ? { include_history: false } : {}),
      },
    );

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse(isHistory ? { ok: true, practiceHistory: data } : { ok: true, practicePayment: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
