import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reviews/my-review — check if a contact (email/phone) has already reviewed
export async function GET(request: NextRequest) {
  try {
    const contact = request.nextUrl.searchParams.get('contact')
    if (!contact) {
      return NextResponse.json({ error: 'contact প্যারামিটার দিন' }, { status: 400 })
    }

    const trimmed = contact.trim().toLowerCase()

    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: { equals: trimmed, mode: 'insensitive' } },
          { phone: trimmed },
        ],
      },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ reviewed: false, hasAccount: false }, { status: 404 })
    }

    const review = await db.review.findFirst({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!review) {
      return NextResponse.json({ reviewed: false, hasAccount: true })
    }

    return NextResponse.json({ reviewed: true, hasAccount: true })
  } catch {
    return NextResponse.json({ error: 'চেক করতে সমস্যা' }, { status: 500 })
  }
}