import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/user/recent-deals
 * Body: { userId: string }
 *
 * Returns recent deals the user is involved in, ordered by date desc.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId প্রয়োজন' }, { status: 400 })
    }

    const deals = await db.deal.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }, { creatorId: userId }],
      },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json(deals)
  } catch {
    return NextResponse.json(
      { error: 'ডিল লোড করতে সমস্যা' },
      { status: 500 },
    )
  }
}