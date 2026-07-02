import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.teamId !== 'string') {
      return jsonResponse({ ok: false, error: 'Team is required' }, 400);
    }

    if (!['member', 'guest'].includes(body.participantKind) || typeof body.participantId !== 'string') {
      return jsonResponse({ ok: false, error: 'Participant is required' }, 400);
    }

    if (typeof body.description !== 'string' || body.description.trim().length === 0) {
      return jsonResponse({ ok: false, error: 'Description is required' }, 400);
    }

    if (!Number.isInteger(body.amountDkk) || body.amountDkk <= 0) {
      return jsonResponse({ ok: false, error: 'Amount must be greater than 0' }, 400);
    }

    const { data, error } = await supabase.rpc('create_fine', {
      target_team_id: body.teamId,
      p_participant_kind: body.participantKind,
      p_participant_id: body.participantId,
      p_description: body.description,
      p_amount_dkk: body.amountDkk,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, fineBox: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
