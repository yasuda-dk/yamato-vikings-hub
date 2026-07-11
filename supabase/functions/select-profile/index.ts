import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient, requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase, user } = await requireUser(req);
    const body = await req.json();

    if (typeof body.memberId !== 'string') {
      return jsonResponse({ ok: false, error: 'Member is required' }, 400);
    }

    const service = createServiceClient();
    const { data: targetMember, error: targetMemberError } = await service
      .from('members')
      .select('id, team_id, first_name_normalized')
      .eq('id', body.memberId)
      .maybeSingle();

    if (targetMemberError) {
      return jsonResponse({ ok: false, error: targetMemberError.message }, 400);
    }

    if (!targetMember) {
      return jsonResponse({ ok: false, error: 'Member not found' }, 400);
    }

    if (targetMember.first_name_normalized === 'takashi') {
      const takashiPassword = Deno.env.get('TAKASHI_PROFILE_PASSWORD');
      if (!takashiPassword) {
        return jsonResponse({ ok: false, error: 'Takashi profile password is not configured' }, 500);
      }

      if (body.profilePassword !== takashiPassword) {
        return jsonResponse({ ok: false, error: 'Incorrect Takashi password' }, 400);
      }

      const { data: hasAccess, error: accessError } = await supabase.rpc('has_current_device_access', {
        target_team_id: targetMember.team_id,
      });

      if (accessError) {
        return jsonResponse({ ok: false, error: accessError.message }, 400);
      }

      if (!hasAccess) {
        return jsonResponse({ ok: false, error: 'Current device is not approved' }, 400);
      }

      const { error: unlinkError } = await service
        .from('member_device_links')
        .update({ unlinked_at: new Date().toISOString() })
        .eq('auth_user_id', user.id)
        .is('unlinked_at', null);

      if (unlinkError) {
        return jsonResponse({ ok: false, error: unlinkError.message }, 400);
      }

      const { error: linkError } = await service.from('member_device_links').insert({
        member_id: targetMember.id,
        auth_user_id: user.id,
      });

      if (linkError) {
        return jsonResponse({ ok: false, error: linkError.message }, 400);
      }

      return jsonResponse({ ok: true, memberId: targetMember.id });
    }

    const { data, error } = await supabase.rpc('select_member_profile', {
      target_member_id: body.memberId,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, memberId: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
