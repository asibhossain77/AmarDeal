import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { finalizeAuctionIfExpired, minNextBid, round2 } from '@/lib/auction'
import { notifyUser } from '@/lib/push'
import { isAuctionMigrationError } from '@/lib/auction'

const MAX_BID = 10_000_000
const BID_COOLDOWN_MS = 5_000 // anti-spam: 5s between consecutive bids per user per auction

/* ═══════════════════════════════════════════════════════════════
   POST /api/auctions/[id]/bids — place a bid (auth required).
   Server validates: auction active + not expired, bidder is not the
   seller, amount ≥ minNextBid (tiered increment over current top).
   The write is transactional with an in-tx re-check, so two racing
   bids can never both become "highest".
   ═══════════════════════════════════════════════════════════════ */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const bidderId = guard.userId

    const { id } = await params
    const body = await req.json().catch(() => null)
    const amount = Number(body?.amount)

    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_BID) {
      return NextResponse.json({ error: 'অবৈধ বিডের পরিমাণ' }, { status: 400 })
    }
    const bidAmount = round2(amount)

    // Finalize first — an expired auction never accepts bids
    await finalizeAuctionIfExpired(id)

    const auction = await db.auction.findUnique({ where: { id } })
    if (!auction) {
      return NextResponse.json({ error: 'নিলাম পাওয়া যায়নি' }, { status: 404 })
    }
    if (auction.status !== 'active' || auction.endsAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'এই নিলামটি আর সক্রিয় নেই' }, { status: 400 })
    }
    if (auction.sellerId === bidderId) {
      return NextResponse.json({ error: 'নিজের নিলামে বিড করা যাবে না' }, { status: 400 })
    }

    const minBid = minNextBid(auction)
    if (bidAmount < minBid) {
      return NextResponse.json(
        { error: `সর্বনিম্ন বিড ৳${minBid.toLocaleString('en')} — তার বেশি বিড করুন`, minBid },
        { status: 400 }
      )
    }

    // Anti-spam: same user bidding too fast on the same auction
    const myLastBid = await db.bid.findFirst({
      where: { auctionId: id, bidderId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (myLastBid && Date.now() - myLastBid.createdAt.getTime() < BID_COOLDOWN_MS) {
      return NextResponse.json({ error: 'একটু থামুন — কয়েক সেকেন্ড পর আবার বিড করুন' }, { status: 429 })
    }

    const previousTop = auction.highestBidderId
    const previousAmount = auction.currentPrice

    // Transactional write — re-check inside tx (SQLite serializes writes)
    const bid = await db.$transaction(async (tx) => {
      const fresh = await tx.auction.findUnique({ where: { id } })
      if (!fresh || fresh.status !== 'active' || fresh.endsAt.getTime() <= Date.now()) {
        throw new Error('AUCTION_CLOSED')
      }
      const freshMin = minNextBid(fresh)
      if (bidAmount < freshMin) {
        throw new Error(`BID_TOO_LOW:${freshMin}`)
      }

      await tx.bid.create({
        data: { auctionId: id, bidderId, amount: bidAmount },
      })
      await tx.auction.update({
        where: { id },
        data: {
          currentPrice: bidAmount,
          highestBidderId: bidderId,
          bidCount: { increment: 1 },
        },
      })
      return { amount: bidAmount }
    })

    /* ── Fire-and-forget notifications ── */
    ;(async () => {
      try {
        // Outbid the previous top bidder (if any, and not the new bidder)
        if (previousTop && previousTop !== bidderId) {
          notifyUser({
            userId: previousTop,
            type: 'auction_outbid',
            title: 'আপনার বিড টপকে গেছে',
            message: `"${auction.title}" নিলামে অন্য কেউ ৳${bid.amount.toLocaleString('en')} বিড করেছে। আবার বিড করুন!`,
            pushUrl: `/nilam/${id}`,
          }).catch(() => {})
        }
        // Let the seller know there is a new top bid
        if (auction.sellerId !== bidderId) {
          notifyUser({
            userId: auction.sellerId,
            type: 'auction_new_bid',
            title: 'নিলামে নতুন বিড',
            message: `আপনার "${auction.title}" নিলামে একজন বিডার ৳${bid.amount.toLocaleString('en')} বিড করেছে।`,
            pushUrl: `/nilam/${id}`,
          }).catch(() => {})
        }
      } catch (e) {
        console.error('[AUCTION BID] notification error:', e)
      }
    })()

    return NextResponse.json({
      success: true,
      bid: bid,
      auction: {
        id,
        currentPrice: bid.amount,
        bidCount: auction.bidCount + 1,
        isHighestBidder: true,
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'AUCTION_CLOSED') {
        return NextResponse.json({ error: 'এই নিলামটি আর সক্রিয় নেই' }, { status: 400 })
      }
      if (err.message.startsWith('BID_TOO_LOW:')) {
        const minBid = Number(err.message.split(':')[1])
        return NextResponse.json(
          { error: `সর্বনিম্ন বিড ৳${minBid.toLocaleString('en')} — তার বেশি বিড করুন`, minBid },
          { status: 400 }
        )
      }
    }
    if (isAuctionMigrationError(err)) {
      return NextResponse.json({ error: 'নিলাম সিস্টেম প্রস্তুত হয়নি' }, { status: 503 })
    }
    console.error('[AUCTION BID] error:', err)
    return NextResponse.json({ error: 'বিড করা যায়নি — আবার চেষ্টা করুন' }, { status: 500 })
  }
}
