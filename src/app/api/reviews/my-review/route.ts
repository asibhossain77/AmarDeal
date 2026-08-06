import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'midman_session'

// GET /api/reviews/my-review — check if a user has already reviewed
// Supports both authenticated (session) and unauthenticated (contact param) modes
export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null

    // Try authenticated route first
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (sessionId) {
      const user = await db.user.findUnique({
        where: { id: sessionId },
        select: { id: true },
      })
      if (user) userId = user.id
    }

    // Fallback: look up by contact param
    if (!userId) {
      const contact = request.nextUrl.searchParams.get('contact')
      if (contact) {
        const trimmed = contact.trim()
        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: trimmed },
              { phone: trimmed },
            ],
          },
          select: { id: true },
        })
        if (user) userId = user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ reviewed: false, hasAccount: false, review: null })
    }

    const review = await db.review.findFirst({
      where: { userId },
    })

    if (!review) {
      return NextResponse.json({ reviewed: false, hasAccount: true, review: null })
    }

    return NextResponse.json({ reviewed: true, hasAccount: true, review })
  } catch {
    return NextResponse.json({ error: 'চেক করতে সমস্যা' }, { status: 500 })
  }
}
