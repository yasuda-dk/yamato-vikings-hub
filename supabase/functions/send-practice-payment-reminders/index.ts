import webpush from 'https://esm.sh/web-push@3.6.7?target=deno';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';
const TIME_ZONE = 'Europe/Copenhagen';

type ReminderTarget = {
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  member_id: string;
  first_name: string;
  event_id: string;
  event_date: string;
  amount_dkk: number;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const jobToken = Deno.env.get('PAYMENT_REMINDER_JOB_TOKEN');
    const requestToken = req.headers.get('x-reminder-token') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!jobToken || requestToken !== jobToken) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const dryRun = body.dryRun === true;
    const teamId = typeof body.teamId === 'string' ? body.teamId : DEFAULT_TEAM_ID;
    const now = new Date();
    const localNow = getCopenhagenParts(now);

    if (!force && (localNow.weekday !== 'Fri' || localNow.hour !== 20)) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: 'Practice payment reminders run only Friday at 20:00 Europe/Copenhagen.',
        localTime: `${localNow.date} ${String(localNow.hour).padStart(2, '0')}:00`,
      });
    }

    const practiceDate = typeof body.practiceDate === 'string' ? body.practiceDate : getCopenhagenDateOffset(now, -1);
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@yamato-vikings.local';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ ok: false, error: 'Web Push is not configured' }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const service = createServiceClient();
    const { data, error } = await service.rpc('practice_payment_reminder_targets', {
      target_team_id: teamId,
      target_practice_date: practiceDate,
    });

    if (error) return jsonResponse({ ok: false, error: error.message }, 400);

    const targets = (data ?? []) as ReminderTarget[];
    let sent = 0;
    let expired = 0;
    const failures: Array<{ subscriptionId: string; error: string }> = [];

    for (const target of targets) {
      if (dryRun) continue;

      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: {
              p256dh: target.p256dh,
              auth: target.auth,
            },
          },
          JSON.stringify({
            title: 'Yamato Vikings',
            body: `${target.first_name}, your ${target.amount_dkk} kr Practice payment is still not marked paid.`,
            url: './#/',
          }),
        );

        const { error: deliveryError } = await service.from('practice_payment_reminder_deliveries').insert({
          team_id: teamId,
          event_id: target.event_id,
          member_id: target.member_id,
          push_subscription_id: target.subscription_id,
          reminder_kind: 'friday_20_unpaid',
        });

        if (deliveryError && !deliveryError.message.includes('duplicate key')) {
          failures.push({ subscriptionId: target.subscription_id, error: deliveryError.message });
        } else {
          sent += 1;
        }
      } catch (sendError) {
        const statusCode = typeof sendError === 'object' && sendError && 'statusCode' in sendError ? Number(sendError.statusCode) : null;
        if (statusCode === 404 || statusCode === 410) {
          expired += 1;
          await service
            .from('push_subscriptions')
            .update({
              is_active: false,
              revoked_at: new Date().toISOString(),
            })
            .eq('id', target.subscription_id);
        } else {
          failures.push({
            subscriptionId: target.subscription_id,
            error: sendError instanceof Error ? sendError.message : 'Push send failed',
          });
        }
      }
    }

    return jsonResponse({
      ok: true,
      practiceDate,
      dryRun,
      targetCount: targets.length,
      sent,
      expired,
      failureCount: failures.length,
      failures,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});

function getCopenhagenParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';

  return {
    weekday: value('weekday'),
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
  };
}

function getCopenhagenDateOffset(date: Date, offsetDays: number) {
  const local = getCopenhagenParts(date);
  const offsetBase = new Date(`${local.date}T12:00:00.000Z`);
  offsetBase.setUTCDate(offsetBase.getUTCDate() + offsetDays);
  return getCopenhagenParts(offsetBase).date;
}
