import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get seller info
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, imageLink: true, isSeller: true, sellerDisabled: true,
      },
    })

    if (!user || !user.isSeller || user.sellerDisabled) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    // Get business name from application
    const application = await db.sellerApplication.findFirst({
      where: { userId: id, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      select: { businessName: true },
    })

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

    // Get review stats
    const reviews = await db.sellerReview.findMany({
      where: { sellerId: id },
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
    const cookieStore = await req.cookies?.()
    if (cookieStore) {
      const session = cookieStore.get('midman_session')
      if (session?.value) {
        const existing = await db.sellerFollower.findUnique({
          where: { sellerId_followerId: { sellerId: id, followerId: session.value } },
        })
        isFollowing = !!existing
      }
    }

    // Check if current user already reviewed
    let hasReviewed = false
    const cookieStore2 = await req.cookies?.()
    if (cookieStore2) {
      const session = cookieStore2.get('midman_session')
      if (session?.value && session.value !== id) {
        const existingReview = await db.sellerReview.findUnique({
          where: { sellerId_userId: { sellerId: id, userId: session.value } },
        })
        hasReviewed = !!existingReview
      }
    }

    return NextResponse.json({
      seller: {
        id: user.id,
        name: user.name,
        imageLink: user.imageLink,
        businessName: application?.businessName || null,
      },
      products,
      followerCount,
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: { id: r.user.id, name: r.user.name, imageLink: r.user.imageLink },
      })),
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
      isFollowing,
      hasReviewed,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}
