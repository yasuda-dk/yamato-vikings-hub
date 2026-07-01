import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.eventId !== 'string' || typeof body.eventDate !== 'string') {
      return jsonResponse({ ok: false, error: 'Event and new date are required' }, 400);
    }

    const { data, error } = await supabase.rpc('duplicate_event', {
      target_event_id: body.eventId,
      p_event_date: body.eventDate,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, eventId: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
