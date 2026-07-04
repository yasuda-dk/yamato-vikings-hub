import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const teamId = typeof body.teamId === 'string' ? body.teamId : DEFAULT_TEAM_ID;
    const seasonYear = typeof body.seasonYear === 'number' ? body.seasonYear : new Date().getFullYear();

    if (!Number.isInteger(seasonYear) || seasonYear < 2000 || seasonYear > 2100) {
      return jsonResponse({ ok: false, error: 'Choose a valid season year.' }, 400);
    }

    const { data, error } = await supabase.rpc('list_admin_season_events', {
      target_team_id: teamId,
      target_year: seasonYear,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, events: data ?? [] });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
