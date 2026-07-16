import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/**
 * POST /api/user/deals
 * Body: { userId: string }
 *
 * Returns all deals the user is involved in (buyer, seller, or creator).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const deals = await db.deal.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
          { creatorId: userId },
        ],
      },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
        creator: { select: { id: true, name: true, email: true } },
        paymentMethod: { select: { id: true, name: true, accountNumber: true, accountType: true, color: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(deals)
  } catch {
    return NextResponse.json({ error: 'ডিল লোড করতে সমস্যা' }, { status: 500 })
  }
}