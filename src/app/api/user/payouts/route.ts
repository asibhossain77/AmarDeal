import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const payouts = await db.payout.findMany({
      where: { recipientId: userId },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(payouts)
  } catch {
    return NextResponse.json(
      { error: 'পেআউট তথ্য লোড করতে সমস্যা' },
      { status: 500 }
    )
  }
}