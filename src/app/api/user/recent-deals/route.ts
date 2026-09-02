import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/**
 * POST /api/user/recent-deals
 *
 * Returns recent deals the user is involved in, ordered by date desc.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[RECENT DEALS] Error fetching deals:', msg)
    // Log extra info for schema-mismatch debugging
    if (msg.includes('no such column') || msg.includes('no such table')) {
      console.error('[RECENT DEALS] DB SCHEMA MISMATCH — run: prisma db push')
    }
    return NextResponse.json(
      { error: 'ডিল লোড করতে সমস্যা' },
      { status: 500 },
    )
  }
}
