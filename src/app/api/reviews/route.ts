import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

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

// POST /api/reviews — submit review with email/phone verification
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rating, comment, contact } = body

    if (!rating || !comment || !contact) {
      return NextResponse.json({ error: 'রেটিং, মন্তব্য ও ইমেইল/ফোন আবশ্যক' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে' }, { status: 400 })
    }

    if (comment.length > 500) {
      return NextResponse.json({ error: 'মন্তব্য ৫০০ অক্ষরের বেশি হতে পারবে না' }, { status: 400 })
    }

    const trimmed = contact.trim().toLowerCase()

    // Find user by email or phone
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: { equals: trimmed, mode: 'insensitive' } },
          { phone: trimmed },
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'এই ইমেইল/ফোন নম্বর দিয়ে কোনো একাউন্ট নেই', code: 'NO_ACCOUNT' },
        { status: 404 }
      )
    }

    // Check if user already reviewed (one review per user)
    const existing = await db.review.findFirst({
      where: { userId: user.id },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'এই একাউন্ট দিয়ে ইতিমধ্যে একটি রিভিউ দেওয়া হয়েছে', code: 'ALREADY_REVIEWED' },
        { status: 400 }
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