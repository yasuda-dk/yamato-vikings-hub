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

    if (typeof body.fineTypeId !== 'string') {
      return jsonResponse({ ok: false, error: 'Fine type is required' }, 400);
    }

    if (typeof body.isActive !== 'boolean') {
      return jsonResponse({ ok: false, error: 'Fine type status is required' }, 400);
    }

    const { data, error } = await supabase.rpc('update_fine_type', {
      target_team_id: body.teamId,
      p_fine_type_id: body.fineTypeId,
      p_is_active: body.isActive,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, fineBox: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
