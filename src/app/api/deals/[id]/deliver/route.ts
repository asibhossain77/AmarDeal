import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, deliveryStartedEmail } from '@/lib/email'
import { sendWhatsApp, deliveryStartedWa } from '@/lib/whatsapp'
import { requireDealAccess } from '@/lib/deal-guard'
import { sendFcmToUser } from '@/lib/fcm'

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
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (deal.status !== 'payment_verified') {
      return NextResponse.json(
        { error: 'শুধুমাত্র ভেরিফাইড ডিলে ডেলিভারি আপডেট করা যাবে' },
        { status: 400 }
      )
    }

    if (deal.sellerId !== userId) {
      return NextResponse.json({ error: 'আপনি এই ডিলের বিক্রেতা নন' }, { status: 403 })
    }

    const updated = await db.deal.update({
      where: { id },
      data: { status: 'in_delivery' },
    })

    // Notify buyer
    await db.notification.create({
      data: {
        userId: deal.buyerId,
        type: 'delivery_started',
        title: 'ডেলিভারি শুরু',
        message: `"${deal.title}" ডিলে বিক্রেতা কাজ সম্পন্ন করেছেন। দয়া করে পণ্য/সার্ভিস যাচাই করুন।`,
        dealId: deal.id,
      },
    })

    try {
      await fetch(`http://localhost:3004/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: deal.buyerId,
          notification: {
            type: 'delivery_started',
            title: 'ডেলিভারি শুরু',
            message: `"${deal.title}" ডিলে বিক্রেতা কাজ সম্পন্ন করেছেন।`,
            dealId: deal.id,
            createdAt: new Date().toISOString(),
          },
        }),
      })
    } catch { /* silent */ }

    // Push notification to buyer
    void sendFcmToUser(deal.buyerId, '📦 ডেলিভারি', 'বিক্রেতা ডেলিভারি কনফার্ম করেছেন', '/')

    // Email: delivery started
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, () => deliveryStartedEmail(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, deal.seller?.name || 'বিক্রেতা'), 'delivery_started').catch(() => {})
    }

    // WhatsApp: delivery started
    if (deal.buyer?.phone) {
      sendWhatsApp(deal.buyer.phone, () => ({ body: deliveryStartedWa(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, deal.seller?.name || 'বিক্রেতা') }), 'delivery_started').catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ডেলিভারি আপডেটে সমস্যা' }, { status: 500 })
  }
}