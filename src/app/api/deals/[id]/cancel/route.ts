import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCancelledEmail } from '@/lib/email'
import { requireDealAccess } from '@/lib/deal-guard'

const CANCELLABLE_STATUSES = ['created', 'payment_verified']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireDealAccess(req, id)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const deal = await db.deal.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (!CANCELLABLE_STATUSES.includes(deal.status)) {
      return NextResponse.json(
        { error: 'এই অবস্থায় ডিল বাতিল করা যাবে না' },
        { status: 400 }
      )
    }

    // Ownership already verified by requireDealAccess

    const updated = await db.deal.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    // Notify the other party
    const otherPartyId = deal.buyerId === userId ? deal.sellerId : deal.buyerId
    if (otherPartyId) {
      await db.notification.create({
        data: {
          userId: otherPartyId,
          type: 'deal_cancelled',
          title: 'ডিল বাতিল',
          message: `"${deal.title}" ডিলটি বাতিল করা হয়েছে।`,
          dealId: deal.id,
        },
      })

      try {
        await fetch(`http://localhost:3004/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: otherPartyId,
            notification: {
              type: 'deal_cancelled',
              title: 'ডিল বাতিল',
              message: `"${deal.title}" ডিলটি বাতিল করা হয়েছে।`,
              dealId: deal.id,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      } catch { /* silent */ }
    }

    // Email: deal cancelled
    const cancellerName = deal.buyerId === userId ? (deal.buyer?.name || 'ক্রেতা') : (deal.seller?.name || 'বিক্রেতা')
    if (deal.buyer?.email && deal.buyerId !== userId) {
      sendEmail(deal.buyer.email, dealCancelledEmail(deal.buyer.name || 'ক্রেতা', deal.title, cancellerName)).catch(() => {})
    }
    if (deal.seller?.email && deal.sellerId !== userId) {
      sendEmail(deal.seller.email, dealCancelledEmail(deal.seller.name || 'বিক্রেতা', deal.title, cancellerName)).catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ডিল বাতিলে সমস্যা' }, { status: 500 })
  }
}