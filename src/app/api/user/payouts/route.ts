import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Payout has no Prisma relation to Deal (dealId is a plain string and some
    // legacy rows reference deleted deals), so we join manually in JS.
    const payouts = await db.payout.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
    })

    const dealIds = [...new Set(payouts.map((p) => p.dealId).filter(Boolean))]
    const deals = dealIds.length
      ? await db.deal.findMany({
          where: { id: { in: dealIds } },
          select: { id: true, title: true, status: true },
        })
      : []
    const dealMap = new Map(deals.map((d) => [d.id, d]))

    return NextResponse.json(
      payouts.map((p) => ({
        ...p,
        deal: dealMap.get(p.dealId) ?? null,
      }))
    )
  } catch {
    return NextResponse.json(
      { error: 'পেআউট তথ্য লোড করতে সমস্যা' },
      { status: 500 }
    )
  }
}
