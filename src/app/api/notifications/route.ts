import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/**
 * GET /api/notifications
 *   ?count=1   → lightweight poll: returns ONLY { unreadCount }
 *   ?limit=N   → number of notifications (default 50, max 100)
 * Always scoped to the authenticated session user.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { searchParams } = new URL(req.url)

    // Lightweight unread-count poll (badge refresh)
    if (searchParams.get('count')) {
      const unreadCount = await db.notification.count({
        where: { userId, read: false },
      })
      return NextResponse.json({ unreadCount })
    }

    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    // Explicit select WITHOUT the new relatedType/relatedId columns so this
    // endpoint keeps working on databases that haven't received the
    // notification-related-columns migration yet (no P2022 on old schemas).
    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        userId: true,
        dealId: true,
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const unreadCount = await db.notification.count({
      where: { userId, read: false },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch {
    return NextResponse.json({ error: 'নোটিফিকেশন লোড করতে সমস্যা' }, { status: 500 })
  }
}
