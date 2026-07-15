export type NotificationStatus = 'unsupported' | 'default' | 'denied' | 'enabled';

export type NotificationConfig = {
  publicKey: string | null;
  status: NotificationStatus;
};

export type SavePushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
};

export function notificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getBrowserNotificationStatus(): NotificationStatus {
  if (!notificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'enabled';
  return Notification.permission;
}

export function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

export function getPushSubscriptionKeys(subscription: PushSubscription): SavePushSubscriptionInput {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('Could not read notification subscription keys.');
  }

  return {
    endpoint: json.endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  };
}
