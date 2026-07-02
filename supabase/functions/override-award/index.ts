import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const voteTypes = ['MVP', 'Worst'];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.eventId !== 'string') {
      return jsonResponse({ ok: false, error: 'Event is required' }, 400);
    }

    if (!voteTypes.includes(body.awardType)) {
      return jsonResponse({ ok: false, error: 'Award type is required' }, 400);
    }

    if (!['member', 'guest'].includes(body.candidateKind) || typeof body.candidateId !== 'string') {
      return jsonResponse({ ok: false, error: 'Candidate is required' }, 400);
    }

    const { data, error } = await supabase.rpc('override_event_award', {
      target_event_id: body.eventId,
      p_award_type: body.awardType,
      p_candidate_member_id: body.candidateKind === 'member' ? body.candidateId : null,
      p_candidate_event_guest_id: body.candidateKind === 'guest' ? body.candidateId : null,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, voting: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
