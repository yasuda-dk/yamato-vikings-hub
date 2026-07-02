import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const actions = ['move-participant', 'swap-participants', 'toggle-lock', 'rename-team', 'confirm-teams'];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.eventId !== 'string' || typeof body.action !== 'string' || !actions.includes(body.action)) {
      return jsonResponse({ ok: false, error: 'Valid team adjustment is required' }, 400);
    }

    const { data, error } = await supabase.rpc('adjust_draft_team', {
      target_event_id: body.eventId,
      p_action: body.action,
      p_team_id: typeof body.teamId === 'string' ? body.teamId : null,
      p_participant_kind: typeof body.participantKind === 'string' ? body.participantKind : null,
      p_participant_id: typeof body.participantId === 'string' ? body.participantId : null,
      p_target_team_id: typeof body.targetTeamId === 'string' ? body.targetTeamId : null,
      p_name: typeof body.name === 'string' ? body.name : null,
      p_is_locked: typeof body.isLocked === 'boolean' ? body.isLocked : null,
      p_swap_participant_kind: typeof body.swapParticipantKind === 'string' ? body.swapParticipantKind : null,
      p_swap_participant_id: typeof body.swapParticipantId === 'string' ? body.swapParticipantId : null,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, teams: data ?? [] });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
