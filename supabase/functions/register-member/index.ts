import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    const { data, error } = await supabase.rpc('register_member_profile', {
      target_team_id: typeof body.teamId === 'string' ? body.teamId : DEFAULT_TEAM_ID,
      p_first_name: body.firstName,
      p_age_group: body.ageGroup,
      p_football_level: body.footballLevel,
      p_primary_position: body.primaryPosition,
      p_secondary_position: body.secondaryPosition === 'None' ? null : body.secondaryPosition,
      p_residence_type: body.residenceType,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, memberId: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
