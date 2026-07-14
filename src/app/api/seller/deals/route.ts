import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/seller/deals
 * Body: { userId: string }
 *
 * Returns all deals where the user is the seller.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId প্রয়োজন' }, { status: 400 })
    }

    const deals = await db.deal.findMany({
      where: {
        sellerId: userId,
      },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(deals)
  } catch {
    return NextResponse.json({ error: 'ডিল লোড করতে সমস্যা' }, { status: 500 })
  }
}