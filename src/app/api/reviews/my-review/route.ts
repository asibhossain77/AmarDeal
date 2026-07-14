import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

// GET /api/reviews/my-review — check if current user has already reviewed
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response

    const review = await db.review.findFirst({
      where: { userId: auth.userId },
      select: { id: true },
    })

    if (!review) {
      return NextResponse.json({ reviewed: false }, { status: 404 })
    }

    return NextResponse.json({ reviewed: true, reviewId: review.id })
  } catch {
    return NextResponse.json({ error: 'চেক করতে সমস্যা' }, { status: 500 })
  }
}