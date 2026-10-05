import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/**
 * Mark ONE notification as read.
 * SECURITY: session-authenticated; the notification must belong to the
 * session user — a user can never mutate another user's notification.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const { id } = await params

    const existing = await db.notification.findUnique({
      where: { id },
      // Explicit select — keeps working on pre-migration databases without
      // the relatedType/relatedId columns (no P2022).
      select: { id: true, userId: true, read: true },
    })
    if (!existing || existing.userId !== guard.userId) {
      return NextResponse.json({ error: 'নোটিফিকেশন পাওয়া যায়নি' }, { status: 404 })
    }

    if (!existing.read) {
      await db.notification.update({ where: { id }, data: { read: true } })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'আপডেট করতে সমস্যা' }, { status: 500 })
  }
}
