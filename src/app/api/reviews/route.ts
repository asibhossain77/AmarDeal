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

// POST /api/reviews — submit a new review (anyone)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, rating, comment } = body

    if (!name || !rating || !comment) {
      return NextResponse.json({ error: 'নাম, রেটিং ও মন্তব্য আবশ্যক' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে' }, { status: 400 })
    }

    if (comment.length > 500) {
      return NextResponse.json({ error: 'মন্তব্য ৫০০ অক্ষরের বেশি হতে পারবে না' }, { status: 400 })
    }

    if (name.length > 50) {
      return NextResponse.json({ error: 'নাম ৫০ অক্ষরের বেশি হতে পারবে না' }, { status: 400 })
    }

    const review = await db.review.create({
      data: { name, rating, comment, isApproved: true },
    })

    return NextResponse.json(review, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'রিভিউ জমা দিতে সমস্যা' }, { status: 500 })
  }
}