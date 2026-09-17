import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/* ═══════════════════════════════════════════════════════════════
   POST /api/auctions/[id]/cancel — seller cancels their auction.
   Fairness rule: only allowed while the auction is active AND has
   zero bids (once someone bids, the auction must run its course).
   ═══════════════════════════════════════════════════════════════ */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const { id } = await params

    const auction = await db.auction.findUnique({ where: { id } })
    if (!auction) {
      return NextResponse.json({ error: 'নিলাম পাওয়া যায়নি' }, { status: 404 })
    }
    if (auction.sellerId !== guard.userId) {
      return NextResponse.json({ error: 'এটি আপনার নিলাম নয়' }, { status: 403 })
    }
    if (auction.status !== 'active') {
      return NextResponse.json({ error: 'শুধু চলমান নিলাম বাতিল করা যায়' }, { status: 400 })
    }
    if (auction.bidCount > 0) {
      return NextResponse.json(
        { error: 'বিড পড়ার পর নিলাম বাতিল করা যাবে না — নিলামটি শেষ হওয়া পর্যন্ত চলবে' },
        { status: 400 }
      )
    }

    await db.auction.update({ where: { id }, data: { status: 'cancelled' } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[AUCTION CANCEL] error:', err)
    return NextResponse.json({ error: 'নিলাম বাতিল করা যায়নি' }, { status: 500 })
  }
}
