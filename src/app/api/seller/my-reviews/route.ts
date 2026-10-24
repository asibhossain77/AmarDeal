import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/**
 * GET /api/seller/my-reviews — the seller's own reviews (dashboard panel).
 * Returns published + hidden reviews so the seller can see moderation state,
 * reply publicly, and see the aggregate from published reviews only.
 * Sellers can never delete reviews here — moderation is admin-only.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isSeller: true },
    })
    if (!user?.isSeller) {
      return NextResponse.json({ error: 'সেলার অনুমোদিত নয়' }, { status: 403 })
    }

    const reviews = await db.sellerReview.findMany({
      where: { sellerId: userId },
      include: {
        user: { select: { id: true, name: true, imageLink: true } },
        order: { select: { id: true, orderNumber: true, serviceName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const published = reviews.filter(r => r.status === 'published')
    const avgRating = published.length > 0
      ? Math.round((published.reduce((s, r) => s + r.rating, 0) / published.length) * 10) / 10
      : 0

    return NextResponse.json({
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        createdAt: r.createdAt,
        sellerReply: r.sellerReply,
        sellerReplyAt: r.sellerReplyAt,
        order: r.order ? { id: r.order.id, orderNumber: r.order.orderNumber, title: r.order.serviceName } : null,
        user: { id: r.user.id, name: r.user.name, imageLink: r.user.imageLink },
      })),
      avgRating,
      reviewCount: published.length,
      hiddenCount: reviews.length - published.length,
    })
  } catch {
    return NextResponse.json({ error: 'রিভিউ লোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
