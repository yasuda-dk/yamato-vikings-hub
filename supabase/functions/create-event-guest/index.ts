import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.eventId !== 'string') {
      return jsonResponse({ ok: false, error: 'Event is required' }, 400);
    }

    const { data, error } = await supabase.rpc('create_event_guest', {
      target_event_id: body.eventId,
      p_first_name: body.firstName,
      p_age_group: body.ageGroup,
      p_football_level: body.footballLevel,
      p_primary_position: body.primaryPosition,
      p_secondary_position: body.secondaryPosition === 'None' ? null : body.secondaryPosition,
      p_residence_type: body.residenceType,
      p_gender: body.gender ?? 'Not specified',
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, eventGuestId: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
