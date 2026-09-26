import { db } from '@/lib/db'

/**
 * Deal read-state helpers — power the unread badge on the deal lists
 * (My Deals / seller deals / any participant's list).
 *
 * A deal counts as "unread" for a user when either:
 *  1. Someone else sent chat messages after the user's lastReadAt, or
 *  2. The deal row changed (status update, payment, delivery…) after the
 *     deal.updatedAt snapshot the user last saw (lastSeenDealUpdated).
 *
 * Storing the updatedAt snapshot (instead of just a timestamp) means the
 * user's OWN actions never flag their own list: any action refetches the
 * deal, which re-snapshots the fresh updatedAt and clears the flag.
 */

type DealRowLike = {
  id: string
  updatedAt: string | Date
}

export type DealUnreadMeta = {
  unreadCount: number
  hasUpdate: boolean
}

/**
 * Mark a deal as read for a user: stores now() as the message threshold and
 * snapshots the deal's current updatedAt. Never throws — if the table does
 * not exist yet (fresh database before /api/health auto-setup) the badge
 * simply keeps working in "everything unread" mode.
 */
export async function markDealRead(dealId: string, userId: string): Promise<void> {
  try {
    const deal = await db.deal.findUnique({
      where: { id: dealId },
      select: { updatedAt: true },
    })
    if (!deal) return

    const now = new Date()
    await db.dealReadState.upsert({
      where: { dealId_userId: { dealId, userId } },
      create: {
        dealId,
        userId,
        lastReadAt: now,
        lastSeenDealUpdated: deal.updatedAt,
      },
      update: {
        lastReadAt: now,
        lastSeenDealUpdated: deal.updatedAt,
      },
    })
  } catch {
    // Table not created yet on this database — badge stays "unread" until
    // /api/health auto-setup runs. Never block the response.
  }
}

/**
 * Attach { unreadCount, hasUpdate } to each deal of a list response.
 * - unreadCount: chat messages from other participants after the user's
 *   lastReadAt (system lines excluded — see below).
 * - hasUpdate: deal.updatedAt changed since the user last saw the deal.
 *   For a deal the user never opened this is always true (a brand-new or
 *   externally-updated deal is exactly what the badge should point at).
 */
export async function attachUnreadMeta<T extends DealRowLike>(
  deals: T[],
  userId: string
): Promise<(T & DealUnreadMeta)[]> {
  const EMPTY: DealUnreadMeta = { unreadCount: 0, hasUpdate: false }
  if (deals.length === 0) return deals.map(d => ({ ...d, ...EMPTY }))

  type ReadRow = { dealId: string; lastReadAt: Date; lastSeenDealUpdated: Date | null }
  let reads: ReadRow[] = []
  try {
    reads = await db.dealReadState.findMany({
      where: { userId, dealId: { in: deals.map(d => d.id) } },
      select: { dealId: true, lastReadAt: true, lastSeenDealUpdated: true },
    })
  } catch {
    // Table missing — every deal stays fully unread (thresholds = 0)
  }
  const readMap = new Map(reads.map(r => [r.dealId, r]))

  // One bounded scan: only messages newer than the OLDEST read threshold.
  const minThreshold = reads.length
    ? Math.min(...reads.map(r => r.lastReadAt.getTime()))
    : 0
  type MsgRow = { dealId: string; createdAt: Date }
  let msgs: MsgRow[] = []
  if (minThreshold > 0 || reads.length === 0) {
    try {
      msgs = await db.chatMessage.findMany({
        where: {
          dealId: { in: deals.map(d => d.id) },
          senderId: { not: userId },
          // System lines ("call admin" hint, dispute resolution…) are not
          // human messages — their side effects bump deal.updatedAt, so the
          // hasUpdate flag still surfaces them. The red count badge stays
          // reserved for real chat activity from the other participants.
          role: { not: 'system' },
          ...(minThreshold > 0 ? { createdAt: { gt: new Date(minThreshold) } } : {}),
        },
        select: { dealId: true, createdAt: true },
      })
    } catch {
      // Chat table issues should never break the deals list
    }
  }

  const unreadByDeal = new Map<string, number>()
  for (const m of msgs) {
    const threshold = readMap.get(m.dealId)?.lastReadAt.getTime() ?? 0
    if (m.createdAt.getTime() > threshold) {
      unreadByDeal.set(m.dealId, (unreadByDeal.get(m.dealId) ?? 0) + 1)
    }
  }

  return deals.map(d => {
    const read = readMap.get(d.id)
    const seenUpdated = read?.lastSeenDealUpdated?.getTime() ?? 0
    return {
      ...d,
      unreadCount: unreadByDeal.get(d.id) ?? 0,
      hasUpdate: new Date(d.updatedAt).getTime() > seenUpdated,
    }
  })
}
