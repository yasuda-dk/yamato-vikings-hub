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

    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return jsonResponse({ ok: false, error: 'Fine type name is required' }, 400);
    }

    if (!Number.isInteger(body.defaultAmountDkk) || body.defaultAmountDkk < 0) {
      return jsonResponse({ ok: false, error: 'Default amount must be 0 or more' }, 400);
    }

    const { data, error } = await supabase.rpc('create_fine_type', {
      target_team_id: body.teamId,
      p_name: body.name,
      p_default_amount_dkk: body.defaultAmountDkk,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, fineBox: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
