import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient, requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase, user } = await requireUser(req);
    const body = await req.json();

    if (typeof body.teamId !== 'string') {
      return jsonResponse({ ok: false, error: 'Team is required' }, 400);
    }

    const { data: hasAccess, error: accessError } = await supabase.rpc('has_current_device_access', {
      target_team_id: body.teamId,
    });

    if (accessError) return jsonResponse({ ok: false, error: accessError.message }, 400);
    if (!hasAccess) return jsonResponse({ ok: false, error: 'Current device is not approved' }, 400);

    const { data: memberId, error: memberError } = await supabase.rpc('current_member_id');
    if (memberError) return jsonResponse({ ok: false, error: memberError.message }, 400);
    if (!memberId) return jsonResponse({ ok: false, error: 'No active member profile selected' }, 400);

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? null;
    const service = createServiceClient();
    const { data: subscription, error: subscriptionError } = await service
      .from('push_subscriptions')
      .select('id')
      .eq('team_id', body.teamId)
      .eq('auth_user_id', user.id)
      .eq('member_id', memberId)
      .eq('is_active', true)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle();

    if (subscriptionError) return jsonResponse({ ok: false, error: subscriptionError.message }, 400);

    return jsonResponse({
      ok: true,
      notification: {
        publicKey,
        status: subscription ? 'enabled' : 'default',
      },
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
