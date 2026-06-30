import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();
    const password = typeof body.password === 'string' ? body.password : '';
    const teamId = typeof body.teamId === 'string' ? body.teamId : DEFAULT_TEAM_ID;

    if (!password) {
      return jsonResponse({ ok: false, error: 'Password is required' }, 400);
    }

    const { data, error } = await supabase.rpc('verify_team_password', {
      target_team_id: teamId,
      plain_password: password,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    if (data !== true) {
      return jsonResponse({ ok: false, error: 'Incorrect team password' }, 401);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
