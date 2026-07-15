import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient, requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase, user } = await requireUser(req);
    const body = await req.json();

    if (typeof body.teamId !== 'string') return jsonResponse({ ok: false, error: 'Team is required' }, 400);
    if (typeof body.endpoint !== 'string' || !body.endpoint.startsWith('https://')) return jsonResponse({ ok: false, error: 'Notification endpoint is required' }, 400);
    if (typeof body.p256dh !== 'string' || body.p256dh.length === 0) return jsonResponse({ ok: false, error: 'Notification key is required' }, 400);
    if (typeof body.auth !== 'string' || body.auth.length === 0) return jsonResponse({ ok: false, error: 'Notification auth secret is required' }, 400);

    const { data: hasAccess, error: accessError } = await supabase.rpc('has_current_device_access', {
      target_team_id: body.teamId,
    });

    if (accessError) return jsonResponse({ ok: false, error: accessError.message }, 400);
    if (!hasAccess) return jsonResponse({ ok: false, error: 'Current device is not approved' }, 400);

    const { data: memberId, error: memberError } = await supabase.rpc('current_member_id');
    if (memberError) return jsonResponse({ ok: false, error: memberError.message }, 400);
    if (!memberId) return jsonResponse({ ok: false, error: 'No active member profile selected' }, 400);

    const service = createServiceClient();
    const { error: upsertError } = await service.from('push_subscriptions').upsert(
      {
        team_id: body.teamId,
        auth_user_id: user.id,
        member_id: memberId,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
        user_agent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: 'endpoint' },
    );

    if (upsertError) return jsonResponse({ ok: false, error: upsertError.message }, 400);

    return jsonResponse({
      ok: true,
      notification: {
        publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? null,
        status: 'enabled',
      },
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
