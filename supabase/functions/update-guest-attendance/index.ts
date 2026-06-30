import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.eventGuestId !== 'string') {
      return jsonResponse({ ok: false, error: 'Guest is required' }, 400);
    }

    const { data, error } = await supabase.rpc('set_guest_actual_status', {
      target_event_guest_id: body.eventGuestId,
      p_actual_status: body.actualStatus,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, eventGuestId: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
