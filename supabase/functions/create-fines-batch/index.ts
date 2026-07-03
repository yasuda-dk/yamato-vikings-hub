import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

type ParticipantSelection = {
  kind?: unknown;
  id?: unknown;
};

type RpcParticipantSelection = {
  participant_kind: 'member' | 'guest';
  participant_id: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.teamId !== 'string') {
      return jsonResponse({ ok: false, error: 'Team is required' }, 400);
    }

    if (!Array.isArray(body.participants) || body.participants.length === 0) {
      return jsonResponse({ ok: false, error: 'Select at least one participant' }, 400);
    }

    if (body.participants.length > 50) {
      return jsonResponse({ ok: false, error: 'A batch can include at most 50 participants' }, 400);
    }

    const participants: RpcParticipantSelection[] = body.participants.map((participant: ParticipantSelection) => {
      if (!['member', 'guest'].includes(String(participant.kind)) || typeof participant.id !== 'string') {
        throw new Error('Participant is required');
      }

      return {
        participant_kind: participant.kind as 'member' | 'guest',
        participant_id: participant.id,
      };
    });

    const uniqueKeys = new Set(participants.map((participant) => `${participant.participant_kind}:${participant.participant_id}`));
    if (uniqueKeys.size !== participants.length) {
      return jsonResponse({ ok: false, error: 'Each participant can be selected only once' }, 400);
    }

    if (typeof body.description !== 'string' || body.description.trim().length === 0) {
      return jsonResponse({ ok: false, error: 'Description is required' }, 400);
    }

    if (!Number.isInteger(body.amountDkk) || body.amountDkk <= 0) {
      return jsonResponse({ ok: false, error: 'Amount must be greater than 0' }, 400);
    }

    const { data, error } = await supabase.rpc('create_fines', {
      target_team_id: body.teamId,
      p_participants: participants,
      p_description: body.description,
      p_amount_dkk: body.amountDkk,
      p_fine_type_id: typeof body.fineTypeId === 'string' ? body.fineTypeId : null,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, fineBox: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
