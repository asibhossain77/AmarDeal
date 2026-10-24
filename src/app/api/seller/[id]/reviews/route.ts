import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/seller/[id]/reviews — submit or update a VERIFIED-PURCHASE review (Phase 8).
 *
 * Eligibility is enforced here on the backend:
 *  - The reviewer must be the BUYER (userId) of a MarketplaceOrder with
 *    status 'completed' whose sellerId is this seller. 'completed' is only
 *    reachable on paid orders, so every eligible review is a verified purchase.
 *  - The review is linked to that specific order (orderId).
 *  - Duplicates are impossible (unique per seller+buyer+order); resubmitting
 *    UPDATES the existing review — the explicit review-edit policy.
 *  - A hidden (moderated) review can be edited by its author but stays hidden
 *    until an admin restores it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sellerId } = await params
    const session = req.cookies.get('midman_session')
    if (!session?.value) {
      return NextResponse.json({ error: 'Login required', code: 'NO_SESSION' }, { status: 401 })
    }

    const userId = session.value
    if (userId === sellerId) {
      return NextResponse.json({ error: 'Cannot review yourself', code: 'SELF_REVIEW' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    const { rating, comment, orderId } = body || {}

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5', code: 'INVALID_RATING' }, { status: 400 })
    }
    if (!comment || typeof comment !== 'string' || comment.trim().length < 3) {
      return NextResponse.json({ error: 'Comment too short', code: 'INVALID_COMMENT' }, { status: 400 })
    }
    if (comment.trim().length > 1000) {
      return NextResponse.json({ error: 'Comment too long', code: 'INVALID_COMMENT' }, { status: 400 })
    }
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: 'অনুগ্রহ করে একটি সম্পন্ন অর্ডার নির্বাচন করুন', code: 'NO_ORDER' },
        { status: 400 },
      )
    }

    // Verify seller exists and is active
    const seller = await db.user.findUnique({
      where: { id: sellerId },
      select: { isSeller: true, sellerDisabled: true },
    })
    if (!seller?.isSeller || seller.sellerDisabled) {
      return NextResponse.json({ error: 'Seller not found', code: 'SELLER_NOT_FOUND' }, { status: 404 })
    }

    // ── Verified-purchase eligibility (authoritative, backend-only) ──
    const order = await db.marketplaceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, sellerId: true, status: true, paymentStatus: true, serviceName: true },
    })
    if (
      !order ||
      order.userId !== userId ||
      order.sellerId !== sellerId ||
      order.status !== 'completed' ||
      order.paymentStatus !== 'paid'
    ) {
      return NextResponse.json(
        {
          error: 'শুধুমাত্র সফলভাবে সম্পন্ন অর্ডারের ক্রেতারা এই সেলারকে রিভিউ দিতে পারবেন',
          code: 'NOT_ELIGIBLE',
        },
        { status: 403 },
      )
    }

    // Upsert per (seller, buyer, order) — one review per order, resubmission edits it
    const review = await db.sellerReview.upsert({
      where: { sellerId_userId_orderId: { sellerId, userId, orderId } },
      update: { rating, comment: comment.trim() },
      create: { sellerId, userId, orderId, rating, comment: comment.trim(), status: 'published' },
      include: {
        user: { select: { id: true, name: true, imageLink: true } },
      },
    })

    // Recalculate aggregate from published (valid) reviews only
    const publishedReviews = await db.sellerReview.findMany({
      where: { sellerId, status: 'published' },
      select: { rating: true },
    })
    const avgRating = publishedReviews.length > 0
      ? Math.round((publishedReviews.reduce((s, r) => s + r.rating, 0) / publishedReviews.length) * 10) / 10
      : 0

    return NextResponse.json({
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        orderId: review.orderId,
        sellerReply: review.sellerReply,
        sellerReplyAt: review.sellerReplyAt,
        user: { id: review.user.id, name: review.user.name, imageLink: review.user.imageLink },
      },
      avgRating,
      reviewCount: publishedReviews.length,
    })
  } catch (err: unknown) {
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'এই অর্ডারের জন্য ইতিমধ্যে রিভিউ রয়েছে', code: 'DUPLICATE' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Failed', code: 'INTERNAL' }, { status: 500 })
  }
}
