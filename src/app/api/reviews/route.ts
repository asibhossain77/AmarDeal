import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

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

// POST /api/reviews — submit a new review (auth required)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { rating, comment } = body

    if (!rating || !comment) {
      return NextResponse.json({ error: 'রেটিং ও মন্তব্য আবশ্যক' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে' }, { status: 400 })
    }

    if (comment.length > 500) {
      return NextResponse.json({ error: 'মন্তব্য ৫০০ অক্ষরের বেশি হতে পারবে না' }, { status: 400 })
    }

    // Get user info from account (name is auto-filled, not from input)
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }

    // Check if user already reviewed (one review per user)
    const existing = await db.review.findFirst({
      where: { userId: user.id },
    })
    if (existing) {
      return NextResponse.json({ error: 'আপনি ইতিমধ্যে একটি রিভিউ দিয়েছেন' }, { status: 400 })
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

    return NextResponse.json(review, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'রিভিউ জমা দিতে সমস্যা' }, { status: 500 })
  }
}