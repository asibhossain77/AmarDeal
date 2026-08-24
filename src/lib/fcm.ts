import { getAdminMessaging } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import { messaging } from 'firebase-admin';

const NotRegisteredErrorCode = 'messaging/registration-token-not-registered';

export function isFcmConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

interface FcmSendParams {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendToTokens(tokens: { id: string; token: string }[], params: FcmSendParams): Promise<number> {
  if (tokens.length === 0) return 0;

  if (!isFcmConfigured()) {
    console.warn('[FCM] Cannot send — FIREBASE_SERVICE_ACCOUNT not configured');
    return 0;
  }

  const adminMessaging = getAdminMessaging();
  let successCount = 0;
  const invalidIds: string[] = [];

  // Send in batches of 500 (FCM limit)
  const batchSize = 500;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);

    const message: messaging.MulticastMessage = {
      tokens: batch.map((t) => t.token),
      notification: {
        title: params.title,
        body: params.body,
      },
      data: {
        title: params.title,
        body: params.body,
        url: params.url || '/',
        icon: '/logo.svg',
        badge: '/logo.svg',
        tag: params.tag || `midman-${Date.now()}`,
      },
      webpush: {
        notification: {
          icon: '/logo.svg',
          badge: '/logo.svg',
        },
        fcmOptions: {
          link: params.url || '/',
        },
      },
    };

    try {
      const response = await adminMessaging.sendEachForMulticast(message);
      successCount += response.successCount;
      console.log(`[FCM] Batch sent: ${response.successCount} success, ${response.failureCount} failure out of ${batch.length}`);

      // Collect invalid tokens
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          resp.error &&
          (resp.error.code === NotRegisteredErrorCode ||
            resp.error.message?.includes('not registered') ||
            resp.error.message?.includes('InvalidRegistration'))
        ) {
          invalidIds.push(batch[idx].id);
        }
      });
    } catch (err) {
      console.error('[FCM] Batch send error:', err);
    }
  }

  // Auto-delete invalid tokens
  if (invalidIds.length > 0) {
    console.log(`[FCM] Deleting ${invalidIds.length} invalid tokens`);
    await db.fcmToken.deleteMany({ where: { id: { in: invalidIds } } });
  }

  return successCount;
}

/** Send an FCM notification to all tokens of a user */
export async function sendFcmToUser(userId: string, title: string, body: string, url?: string, tag?: string): Promise<number> {
  const tokens = await db.fcmToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return 0;

  return sendToTokens(tokens, { title, body, url, tag });
}

/** Send FCM to multiple users */
export async function sendFcmToUsers(userIds: string[], title: string, body: string, url?: string, tag?: string): Promise<number> {
  let total = 0;
  for (const userId of userIds) {
    total += await sendFcmToUser(userId, title, body, url, tag);
  }
  return total;
}

/** Send FCM to ALL subscribers (admin broadcast) */
export async function sendFcmToAll(title: string, body: string, url?: string): Promise<number> {
  const tokens = await db.fcmToken.findMany({
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return 0;

  return sendToTokens(tokens, {
    title,
    body,
    url: url || '/',
    tag: `midman-broadcast-${Date.now()}`,
  });
}
