import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const votingStatuses = ['Voting open', 'Completed'];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.eventId !== 'string') {
      return jsonResponse({ ok: false, error: 'Event is required' }, 400);
    }

    if (!votingStatuses.includes(body.status)) {
      return jsonResponse({ ok: false, error: 'Voting status is required' }, 400);
    }

    const { data, error } = await supabase.rpc('set_event_voting_status', {
      target_event_id: body.eventId,
      p_status: body.status,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, voting: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
