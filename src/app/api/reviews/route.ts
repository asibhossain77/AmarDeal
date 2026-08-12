import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'midman_session'

// GET /api/reviews — public: approved reviews only
export async function GET() {
  try {
    const reviews = await db.review.findMany({
      where: { isApproved: true },
      take: 50,
    })
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json(reviews)
  } catch {
    return NextResponse.json({ error: 'রিভিউ লোড করতে সমস্যা' }, { status: 500 })
  }
}

// POST /api/reviews — submit review
// Supports both authenticated (session cookie) and unauthenticated (contact-based) submission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rating, comment, contact } = body

    if (!rating || !comment) {
      return NextResponse.json({ error: 'রেটিং ও মন্তব্য আবশ্যক' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে' }, { status: 400 })
    }

    if (comment.length > 500) {
      return NextResponse.json({ error: 'মন্তব্য ৫০০ অক্ষরের বেশি হতে পারবে না' }, { status: 400 })
    }

    // Try authenticated route first (logged-in user)
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    let user: { id: string; name: string } | null = null

    if (sessionId) {
      const dbUser = await db.user.findUnique({
        where: { id: sessionId },
        select: { id: true, name: true },
      })
      if (dbUser) user = dbUser
    }

    // Fallback: unauthenticated — verify by contact (email/phone)
    if (!user && contact) {
      const trimmed = contact.trim()
      user = await db.user.findFirst({
        where: {
          OR: [
            { email: trimmed },
            { phone: trimmed },
          ],
        },
        select: { id: true, name: true },
      })
    }

    if (!user) {
      return NextResponse.json(
        { error: 'একাউন্ট পাওয়া যায়নি', code: 'NO_ACCOUNT' },
        { status: 404 }
      )
    }

    const review = await db.review.create({
      data: {
        name: user.name,
        rating,
        comment,
        userId: user.id,
        isApproved: true,
      },
    })

    return NextResponse.json({ success: true, review }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'রিভিউ জমা দিতে সমস্যা' }, { status: 500 })
  }
}
