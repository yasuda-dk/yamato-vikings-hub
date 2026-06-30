import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const teamId = typeof body.teamId === 'string' ? body.teamId : DEFAULT_TEAM_ID;

    const { data: hasAccess, error: accessError } = await supabase.rpc('has_current_device_access', {
      target_team_id: teamId,
    });

    if (accessError) {
      return jsonResponse({ ok: false, error: accessError.message }, 400);
    }

    if (!hasAccess) {
      return jsonResponse({ ok: true, hasAccess: false, selectedMember: null, members: [] });
    }

    const { data: currentMemberId } = await supabase.rpc('current_member_id');
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, first_name, age_group, football_level, primary_position, secondary_position, residence_type, gender, membership_status, application_role, created_at')
      .eq('team_id', teamId)
      .order('first_name');

    if (membersError) {
      return jsonResponse({ ok: false, error: membersError.message }, 400);
    }

    return jsonResponse({
      ok: true,
      hasAccess: true,
      selectedMember: members?.find((member) => member.id === currentMemberId) ?? null,
      members: members ?? [],
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
