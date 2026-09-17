import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { finalizeExpiredAuctions, maskName, ensureAuctionTables } from '@/lib/auction'
import { isAuctionMigrationError } from '@/lib/auction'

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/auctions — the seller's own auctions (all statuses)
   for the dashboard নিলাম panel. Includes winner first name + dealId
   so the seller can jump straight into the escrow deal.
   ═══════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    await ensureAuctionTables()
    await finalizeExpiredAuctions()

    let auctions
    try {
      auctions = await db.auction.findMany({
        where: { sellerId: guard.userId },
        include: {
          winner: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    } catch (err) {
      if (isAuctionMigrationError(err)) {
        auctions = []
      } else throw err
    }

    return NextResponse.json({
      success: true,
      auctions: auctions.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        image: a.image,
        startPrice: a.startPrice,
        currentPrice: a.currentPrice,
        bidCount: a.bidCount,
        status: a.status,
        endsAt: a.endsAt,
        createdAt: a.createdAt,
        dealId: a.dealId,
        finalPrice: a.finalPrice,
        winnerName: a.winner ? maskName(a.winner.name) : null,
      })),
    })
  } catch (err) {
    console.error('[SELLER AUCTIONS] error:', err)
    return NextResponse.json({ error: 'নিলাম লোড করা যায়নি' }, { status: 500 })
  }
}
