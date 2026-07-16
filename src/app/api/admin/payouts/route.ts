import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const payouts = await db.payout.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Enrich with user and deal info
    const enriched = await Promise.all(
      payouts.map(async (p) => {
        const [recipient, deal] = await Promise.all([
          db.user.findUnique({
            where: { id: p.recipientId },
            select: { id: true, name: true, email: true, phone: true },
          }),
          db.deal.findUnique({
            where: { id: p.dealId },
            select: { id: true, title: true, status: true, amount: true, paymentAmount: true, platformFee: true, sellerId: true, buyerId: true },
          }),
        ])

        return {
          ...p,
          recipient,
          deal,
        }
      })
    )

    return NextResponse.json(enriched)
  } catch {
    return NextResponse.json(
      { error: 'পেআউট তথ্য লোড করতে সমস্যা' },
      { status: 500 }
    )
  }
}