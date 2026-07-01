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

    const { data, error } = await supabase.rpc('update_event', {
      target_event_id: body.eventId,
      p_title: body.title,
      p_event_type: body.eventType,
      p_event_date: body.eventDate,
      p_start_time: body.startTime,
      p_location: body.location,
      p_rsvp_deadline: body.rsvpDeadline,
      p_number_of_teams: body.numberOfTeams,
      p_notes: body.notes ?? null,
      p_enable_team_generation: body.enableTeamGeneration,
      p_enable_voting: body.enableVoting,
      p_status: body.status,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, eventId: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
