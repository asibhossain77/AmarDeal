import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { attachUnreadMeta } from '@/lib/deal-read'

/**
 * POST /api/seller/deals
 * Body: { userId: string }
 *
 * Returns all deals where the user is the seller,
 * each with { unreadCount, hasUpdate } for the list unread badge.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const deals = await db.deal.findMany({
      where: {
        sellerId: userId,
      },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
        creator: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(await attachUnreadMeta(deals, userId))
  } catch {
    return NextResponse.json({ error: 'ডিল লোড করতে সমস্যা' }, { status: 500 })
  }
}