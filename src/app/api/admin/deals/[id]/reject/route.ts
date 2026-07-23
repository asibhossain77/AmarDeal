import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCancelledEmail } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const { id } = await params
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

    // Only reject deals that are in payment_pending status
    if (deal.status !== 'payment_pending') {
      return NextResponse.json(
        { error: `শুধুমাত্র 'পেমেন্ট পেন্ডিং' অবস্থার ডিল প্রত্যাখ্যান করা যায়। বর্তমান: ${deal.status}` },
        { status: 400 }
      )
    }

    const updatedDeal = await db.deal.update({
      where: { id },
      data: { status: 'rejected' },
    })

    // Notify both parties
    const notifyParties = [
      { userId: deal.buyerId },
      ...(deal.sellerId ? [{ userId: deal.sellerId }] : []),
    ]

    for (const party of notifyParties) {
      if (!party.userId) continue
      await db.notification.create({
        data: {
          userId: party.userId,
          type: 'deal_rejected',
          title: 'ডিল প্রত্যাখ্যাত',
          message: `"${deal.title}" ডিলটি অ্যাডমিন কর্তৃক প্রত্যাখ্যাত হয়েছে।`,
          dealId: deal.id,
        },
      })

      try {
        await fetch(`http://localhost:3004/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: party.userId,
            notification: {
              type: 'deal_rejected',
              title: 'ডিল প্রত্যাখ্যাত',
              message: `"${deal.title}" ডিলটি প্রত্যাখ্যাত হয়েছে।`,
              dealId: deal.id,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      } catch { /* silent */ }
    }

    // Email: deal rejected (treat as cancellation notification)
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, () => dealCancelledEmail(deal.buyer.name || 'ক্রেতা', deal.title, 'অ্যাডমিন')).catch(() => {})
    }
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, () => dealCancelledEmail(deal.seller.name || 'বিক্রেতা', deal.title, 'অ্যাডমিন')).catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updatedDeal })
  } catch {
    return NextResponse.json({ error: 'প্রত্যাখ্যানে সমস্যা' }, { status: 500 })
  }
}