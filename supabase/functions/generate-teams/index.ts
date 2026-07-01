import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
import { generateTeams, type TeamGenerationParticipant } from '../_shared/team-generation.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.eventId !== 'string') {
      return jsonResponse({ ok: false, error: 'Event is required' }, 400);
    }

    if (![2, 3, 4].includes(body.teamCount)) {
      return jsonResponse({ ok: false, error: 'Choose 2, 3, or 4 teams' }, 400);
    }

    const attemptNumber = Number.isInteger(body.attemptNumber) && body.attemptNumber > 0 ? body.attemptNumber : 1;
    const { data: participants, error: participantsError } = await supabase.rpc('get_team_generation_participants', {
      target_event_id: body.eventId,
    });

    if (participantsError) {
      return jsonResponse({ ok: false, error: participantsError.message }, 400);
    }

    const lockedAssignments: Record<string, number> = {};
    const lockedState: Record<string, boolean> = {};
    let existingTeamNames: string[] = [];

    if (body.preserveLocked === true) {
      const { data: currentTeams, error: currentTeamsError } = await supabase.rpc('get_event_teams', {
        target_event_id: body.eventId,
      });

      if (currentTeamsError) {
        return jsonResponse({ ok: false, error: currentTeamsError.message }, 400);
      }

      existingTeamNames = (currentTeams ?? []).map((team: { name: string }) => team.name);
      for (const [teamIndex, team] of (currentTeams ?? []).entries()) {
        for (const participant of team.participants ?? []) {
          const key = `${participant.kind}:${participant.id}`;
          lockedState[key] = participant.is_locked === true;
          if (participant.is_locked === true) {
            lockedAssignments[key] = teamIndex;
          }
        }
      }
    }

    const result = generateTeams({
      participants: (participants ?? []) as TeamGenerationParticipant[],
      teamCount: body.teamCount,
      seed: `${body.eventId}:${attemptNumber}`,
      lockedAssignments,
    });

    const { data: teams, error: saveError } = await supabase.rpc('save_draft_teams', {
      target_event_id: body.eventId,
      p_teams: result.teams.map((team, teamIndex) => ({
        name: existingTeamNames[teamIndex] ?? team.name,
        participants: team.participants.map((participant) => ({
          kind: participant.kind,
          id: participant.id,
          is_locked: lockedState[`${participant.kind}:${participant.id}`] === true,
        })),
      })),
      p_balance_score: result.score,
      p_score_breakdown: result.scoreBreakdown,
    });

    if (saveError) {
      return jsonResponse({ ok: false, error: saveError.message }, 400);
    }

    return jsonResponse({
      ok: true,
      teams: teams ?? [],
      score: result.score,
      scoreBreakdown: result.scoreBreakdown,
      eligibleCount: result.eligibleParticipants.length,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
