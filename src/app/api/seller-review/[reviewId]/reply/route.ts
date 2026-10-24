import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/**
 * POST /api/seller-review/[reviewId]/reply — the reviewed seller publicly replies to a review.
 * Only the seller who owns the review can reply. Empty reply removes the previous one.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { reviewId } = await params

    const review = await db.sellerReview.findUnique({
      where: { id: reviewId },
      select: { id: true, sellerId: true },
    })
    if (!review) {
      return NextResponse.json({ error: 'রিভিউ পাওয়া যায়নি' }, { status: 404 })
    }
    if (review.sellerId !== userId) {
      return NextResponse.json(
        { error: 'শুধুমাত্র এই রিভিউয়ের সেলার উত্তর দিতে পারবেন' },
        { status: 403 },
      )
    }

    const body = await req.json().catch(() => null)
    const reply = typeof body?.reply === 'string' ? body.reply.trim() : ''

    if (reply.length > 1000) {
      return NextResponse.json({ error: 'উত্তর খুব দীর্ঘ (সর্বোচ্চ ১০০০ অক্ষর)' }, { status: 400 })
    }

    const updated = await db.sellerReview.update({
      where: { id: reviewId },
      data: {
        sellerReply: reply || null,
        sellerReplyAt: reply ? new Date() : null,
      },
      select: { id: true, sellerReply: true, sellerReplyAt: true },
    })

    return NextResponse.json({ success: true, review: updated })
  } catch {
    return NextResponse.json({ error: 'উত্তর সংরক্ষণে সমস্যা হয়েছে' }, { status: 500 })
  }
}
