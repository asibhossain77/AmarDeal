import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sellerId } = await params
    const session = req.cookies.get('midman_session')
    if (!session?.value) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const userId = session.value
    if (userId === sellerId) {
      return NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 })
    }

    const body = await req.json()
    const { rating, comment } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 })
    }
    if (!comment || typeof comment !== 'string' || comment.trim().length < 3) {
      return NextResponse.json({ error: 'Comment too short' }, { status: 400 })
    }

    // Verify seller exists
    const seller = await db.user.findUnique({
      where: { id: sellerId },
      select: { isSeller: true, sellerDisabled: true },
    })
    if (!seller?.isSeller || seller.sellerDisabled) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    // Upsert review
    const review = await db.sellerReview.upsert({
      where: { sellerId_userId: { sellerId, userId } },
      update: { rating, comment: comment.trim() },
      create: { sellerId, userId, rating, comment: comment.trim() },
      include: {
        user: { select: { id: true, name: true, imageLink: true } },
      },
    })

    // Recalculate avg
    const allReviews = await db.sellerReview.findMany({ where: { sellerId } })
    const avgRating = allReviews.length > 0
      ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10
      : 0

    return NextResponse.json({
      review: {
        id: review.id, rating: review.rating, comment: review.comment,
        createdAt: review.createdAt,
        user: { id: review.user.id, name: review.user.name, imageLink: review.user.imageLink },
      },
      avgRating,
      reviewCount: allReviews.length,
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
