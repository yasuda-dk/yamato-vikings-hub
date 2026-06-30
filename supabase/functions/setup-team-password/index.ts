import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const setupToken = Deno.env.get('TEAM_SETUP_TOKEN');
    const providedToken = req.headers.get('x-setup-token');

    if (!setupToken || providedToken !== setupToken) {
      return jsonResponse({ ok: false, error: 'Setup permission is required' }, 403);
    }

    const body = await req.json();
    const password = typeof body.password === 'string' ? body.password : '';
    const teamId = typeof body.teamId === 'string' ? body.teamId : DEFAULT_TEAM_ID;

    if (password.length < 8) {
      return jsonResponse({ ok: false, error: 'Password must be at least 8 characters.' }, 400);
    }

    const supabase = createServiceClient();
    const { error } = await supabase.rpc('initialize_team_password', {
      target_team_id: teamId,
      new_plain_password: password,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
