import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { finalizeAuctionIfExpired, maskName, minNextBid } from '@/lib/auction'
import { isAuctionMigrationError } from '@/lib/auction'

const SESSION_COOKIE = 'midman_session'

/* ═══════════════════════════════════════════════════════════════
   GET /api/auctions/[id] — public auction detail.
   Auth is OPTIONAL: if the viewer is logged in we add viewer flags
   (isOwner / isHighestBidder / isWinner) + the winner's deal link
   for the CTA. Bids return with masked (first-name-only) bidders.
   ═══════════════════════════════════════════════════════════════ */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Lazy finalize — the detail page must never show a stale "active" state
    await finalizeAuctionIfExpired(id)

    const auction = await db.auction.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, imageLink: true } },
        bids: {
          orderBy: { createdAt: 'desc' as const },
          take: 30,
          include: { bidder: { select: { id: true, name: true } } },
        },
        winner: { select: { id: true, name: true } },
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'নিলাম পাওয়া যায়নি' }, { status: 404 })
    }

    // Soft viewer resolution (no 401 — anonymous visitors allowed)
    let viewerId: string | null = null
    try {
      viewerId = req.cookies.get(SESSION_COOKIE)?.value ?? null
      if (viewerId) {
        const exists = await db.user.findUnique({ where: { id: viewerId }, select: { id: true } })
        if (!exists) viewerId = null
      }
    } catch {
      viewerId = null
    }

    const isOwner = !!viewerId && viewerId === auction.sellerId
    const isWinner = !!viewerId && viewerId === auction.winnerId
    const isHighestBidder = !!viewerId && viewerId === auction.highestBidderId

    // Deal link only for the two parties that need the CTA
    const dealId = isWinner || isOwner ? auction.dealId : null

    return NextResponse.json({
      success: true,
      auction: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        category: auction.category,
        image: auction.image,
        startPrice: auction.startPrice,
        currentPrice: auction.currentPrice,
        bidCount: auction.bidCount,
        status: auction.status,
        endsAt: auction.endsAt,
        createdAt: auction.createdAt,
        minNextBid: auction.status === 'active' ? minNextBid(auction) : null,
        seller: { id: auction.seller.id, name: maskName(auction.seller.name), imageLink: auction.seller.imageLink },
        bids: auction.bids.map((b) => ({
          id: b.id,
          amount: b.amount,
          createdAt: b.createdAt,
          bidderName: maskName(b.bidder.name),
          isMine: !!viewerId && b.bidderId === viewerId,
        })),
        winnerName: auction.winner ? maskName(auction.winner.name) : null,
        winnerId: isWinner || isOwner ? auction.winnerId : null,
        dealId,
        viewer: { isOwner, isWinner, isHighestBidder, loggedIn: !!viewerId },
      },
    })
  } catch (err) {
    if (isAuctionMigrationError(err)) {
      return NextResponse.json({ error: 'নিলাম সিস্টেম প্রস্তুত হয়নি' }, { status: 503 })
    }
    console.error('[AUCTION DETAIL] error:', err)
    return NextResponse.json({ error: 'নিলাম লোড করা যায়নি' }, { status: 500 })
  }
}
