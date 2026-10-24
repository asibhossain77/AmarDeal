import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/seller/[id]/public — public storefront data (Phase 8).
 *
 * - storeStatus 'active' | 'suspended': a suspended (disabled) seller's store
 *   exists but is restricted — purchasing options are hidden client-side and
 *   blocked server-side on the order routes.
 * - Reviews: published-only (admin-moderated hidden reviews never appear),
 *   include public seller replies; average is computed from published reviews.
 * - Viewer-scoped eligibleOrders: the viewer's COMPLETED marketplace orders
 *   from this seller, each flagged whether it already has the viewer's review
 *   (edit policy: one review per order, resubmission updates it).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionCookie = req.cookies.get('midman_session')
    const viewerId = sessionCookie?.value || null

    // Get seller info (store fields included)
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, imageLink: true, isSeller: true, sellerDisabled: true,
        sellerRole: true, businessVerified: true,
        businessName: true, businessBio: true,
        businessCategory: true, storeLogo: true, publicContact: true,
      },
    })

    // Never a seller → no store at all
    if (!user || !user.isSeller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    // Suspended seller → storefront exists but is restricted
    if (user.sellerDisabled) {
      return NextResponse.json({
        storeStatus: 'suspended',
        seller: {
          id: user.id,
          name: user.name,
          businessName: user.businessName,
          imageLink: user.imageLink,
          sellerRole: user.sellerRole,
          businessVerified: user.businessVerified,
        },
      })
    }

    // Get active products
    const products = await db.digitalProduct.findMany({
      where: { sellerId: id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, description: true, price: true,
        category: true, image: true, createdAt: true,
      },
    })

    // Get follower count
    const followerCount = await db.sellerFollower.count({
      where: { sellerId: id },
    })

    // Published reviews only — hidden (moderated) reviews never appear publicly
    const reviews = await db.sellerReview.findMany({
      where: { sellerId: id, status: 'published' },
      include: {
        user: { select: { id: true, name: true, imageLink: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

    // Check if current user follows
    let isFollowing = false
    if (viewerId) {
      try {
        const existing = await db.sellerFollower.findUnique({
          where: { sellerId_followerId: { sellerId: id, followerId: viewerId } },
        })
        isFollowing = !!existing
      } catch { /* no session */ }
    }

    // Check if current user already reviewed (backwards compatibility)
    let hasReviewed = false

    // Viewer's completed marketplace orders from this seller → review-eligible
    let eligibleOrders: Array<{
      id: string; orderNumber: string; serviceName: string; totalAmount: number;
      completedAt: Date | null; reviewed: boolean;
      myReview?: { rating: number; comment: string } | null;
    }> = []

    if (viewerId && viewerId !== id) {
      try {
        const completedOrders = await db.marketplaceOrder.findMany({
          where: { userId: viewerId, sellerId: id, status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 20,
          select: { id: true, orderNumber: true, serviceName: true, totalAmount: true, completedAt: true },
        })

        if (completedOrders.length > 0) {
          const orderIds = completedOrders.map(o => o.id)
          const myReviews = await db.sellerReview.findMany({
            where: { sellerId: id, userId: viewerId, orderId: { in: orderIds } },
            select: { orderId: true, rating: true, comment: true },
          })
          const reviewByOrder = new Map(myReviews.map(r => [r.orderId, r]))

          eligibleOrders = completedOrders.map(o => {
            const existing = reviewByOrder.get(o.id)
            return {
              id: o.id,
              orderNumber: o.orderNumber,
              serviceName: o.serviceName,
              totalAmount: o.totalAmount,
              completedAt: o.completedAt,
              reviewed: !!existing,
              myReview: existing ? { rating: existing.rating, comment: existing.comment } : null,
            }
          })
          hasReviewed = eligibleOrders.some(o => o.reviewed)
        }
      } catch { /* viewer has no eligible orders */ }
    }

    return NextResponse.json({
      storeStatus: 'active',
      seller: {
        id: user.id,
        name: user.name,
        imageLink: user.imageLink,
        sellerRole: user.sellerRole,
        businessVerified: user.businessVerified,
        businessName: user.businessName,
        businessBio: user.businessBio,
        businessCategory: user.businessCategory,
        storeLogo: user.storeLogo,
        publicContact: user.publicContact,
      },
      products,
      followerCount,
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        orderId: r.orderId,
        sellerReply: r.sellerReply,
        sellerReplyAt: r.sellerReplyAt,
        user: { id: r.user.id, name: r.user.name, imageLink: r.user.imageLink },
      })),
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
      isFollowing,
      hasReviewed,
      eligibleOrders,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}
