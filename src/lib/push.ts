import webpush from 'web-push'
import { db } from '@/lib/db'

// Configure VAPID
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@amardeal.com'

let configured = false

export function configurePush(): boolean {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[PUSH] VAPID keys not configured')
    return false
  }
  if (!configured) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    configured = true
  }
  return true
}

export function getVapidPublicKey(): string {
  return vapidPublicKey || ''
}

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  data?: Record<string, unknown>
}

/**
 * Send a web push notification to a specific user.
 * This is fire-and-forget — errors are logged but not thrown.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!configurePush()) return

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) return

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo.svg',
      badge: payload.badge || '/logo.svg',
      url: payload.url || '/',
      tag: payload.tag,
      data: payload.data,
    })

    // Send to all user's subscriptions in parallel
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            body,
            {
              TTL: 86400, // 24 hours
              urgency: 'normal',
            }
          )
        } catch (err: any) {
          // If subscription is invalid/expired, remove it
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          }
        }
      })
    )
  } catch (err) {
    console.error('[PUSH] Error sending to user:', userId, err)
  }
}

/**
 * Send a push notification to multiple users.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  await Promise.allSettled(
    userIds.map((uid) => sendPushToUser(uid, payload))
  )
}

/**
 * Send a push notification to all admins.
 */
export async function sendPushToAdmins(
  payload: PushPayload
): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: { admin: { isNot: null } },
      select: { id: true },
    })
    await sendPushToUsers(admins.map((a) => a.id), payload)
  } catch (err) {
    console.error('[PUSH] Error sending to admins:', err)
  }
}

/**
 * Create a DB notification + send push + send WebSocket — all in one.
 * This is the unified notification function to use from API routes.
 */
export interface NotifyOptions {
  userId: string
  dealId?: string
  type: string
  title: string
  message: string
  pushUrl?: string
}

export async function notifyUser(opts: NotifyOptions): Promise<void> {
  const { userId, dealId, type, title, message, pushUrl } = opts

  // 1. Save to DB
  await db.notification.create({
    data: { userId, type, title, message, dealId },
  }).catch(() => {})

  // 2. Send WebSocket notification
  try {
    await fetch('http://localhost:3004/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        notification: { type, title, message, dealId, createdAt: new Date().toISOString() },
      }),
    })
  } catch { /* ws not available */ }

  // 3. Send push notification
  await sendPushToUser(userId, {
    title,
    body: message,
    url: pushUrl || '/',
    tag: dealId ? `deal-${dealId}` : undefined,
    data: { type, dealId },
  })
}

/**
 * Notify admins — same unified function.
 */
export async function notifyAdmins(opts: Omit<NotifyOptions, 'userId'>): Promise<void> {
  // WebSocket to admin room
  try {
    await fetch('http://localhost:3004/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notification: {
          type: opts.type,
          title: opts.title,
          message: opts.message,
          dealId: opts.dealId,
          createdAt: new Date().toISOString(),
        },
      }),
    })
  } catch { /* ws not available */ }

  // Push to all admins
  await sendPushToAdmins({
    title: opts.title,
    body: opts.message,
    url: '/admin',
    tag: opts.dealId ? `deal-${opts.dealId}` : undefined,
    data: { type: opts.type, dealId: opts.dealId },
  })
}
