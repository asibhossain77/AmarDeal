import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/**
 * Mark ALL of the session user's notifications as read.
 * SECURITY: the target user is ALWAYS the authenticated session user —
 * the previous implementation trusted a body userId (IDOR vulnerability).
 */
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    await db.notification.updateMany({
      where: { userId: guard.userId, read: false },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'আপডেট করতে সমস্যা' }, { status: 500 })
  }
}
