import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, paymentVerifiedEmail } from '@/lib/email'
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

    // Only approve deals that are in payment_pending status
    if (deal.status !== 'payment_pending') {
      return NextResponse.json(
        { error: `শুধুমাত্র 'পেমেন্ট পেন্ডিং' অবস্থার ডিল অনুমোদন করা যায়। বর্তমান: ${deal.status}` },
        { status: 400 }
      )
    }

    const updatedDeal = await db.deal.update({
      where: { id },
      data: { status: 'payment_verified' },
    })

    // Notify both parties
    const notifyParties = [
      { userId: deal.buyerId, name: deal.buyer?.name },
      ...(deal.sellerId && deal.seller ? [{ userId: deal.sellerId, name: deal.seller.name }] : []),
    ]

    for (const party of notifyParties) {
      if (!party.userId || !party.name) continue
      await db.notification.create({
        data: {
          userId: party.userId,
          type: 'deal_approved',
          title: 'ডিল অনুমোদিত',
          message: `"${deal.title}" ডিলটি অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে। পেমেন্ট ভেরিফাইড।`,
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
              type: 'deal_approved',
              title: 'ডিল অনুমোদিত',
              message: `"${deal.title}" ডিলটি অনুমোদিত হয়েছে।`,
              dealId: deal.id,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      } catch { /* silent */ }
    }

    // Email notifications
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, () => paymentVerifiedEmail(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, 'buyer')).catch(() => {})
    }
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, () => paymentVerifiedEmail(deal.seller.name || 'বিক্রেতা', deal.title, deal.amount || 0, 'seller')).catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updatedDeal })
  } catch {
    return NextResponse.json({ error: 'অনুমোদনে সমস্যা' }, { status: 500 })
  }
}