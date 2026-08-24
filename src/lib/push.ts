import webpush from 'web-push';
import { db } from '@/lib/db';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@midman.bd';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

interface SendPushParams {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface PushPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  url: string;
  tag: string;
}

function buildPayload(title: string, body: string, url: string, tag: string): string {
  return JSON.stringify({ title, body, icon: '/logo.svg', badge: '/logo.svg', url, tag } as PushPayload);
}

async function sendToSubscriptions(subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: string): Promise<number> {
  let successCount = 0;
  const invalidIds: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24 }
      );
      successCount++;
    } catch (err: unknown) {
      const error = err as { statusCode?: number };
      if (error.statusCode === 404 || error.statusCode === 410) {
        invalidIds.push(sub.id);
      }
    }
  }

  if (invalidIds.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: invalidIds } } });
  }

  return successCount;
}

/** Send a push notification to all subscriptions of a user */
export async function sendPushToUser({ userId, title, body, url = '/', tag }: SendPushParams): Promise<number> {
  if (!vapidPublicKey || !vapidPrivateKey) return 0;

  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return 0;

  return sendToSubscriptions(
    subscriptions,
    buildPayload(title, body, url, tag || `midman-${Date.now()}`)
  );
}

/** Send push to multiple users at once */
export async function sendPushToUsers(userIds: string[], title: string, body: string, url?: string, tag?: string): Promise<number> {
  let total = 0;
  for (const userId of userIds) {
    total += await sendPushToUser({ userId, title, body, url, tag });
  }
  return total;
}

/** Send push to all subscribers (admin broadcast) */
export async function sendPushToAll(title: string, body: string, url?: string): Promise<number> {
  if (!vapidPublicKey || !vapidPrivateKey) return 0;

  const subscriptions = await db.pushSubscription.findMany();
  if (subscriptions.length === 0) return 0;

  return sendToSubscriptions(
    subscriptions,
    buildPayload(title, body, url || '/', `midman-broadcast-${Date.now()}`)
  );
}
