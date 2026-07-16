import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, deliveryStartedEmail } from '@/lib/email'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const { dealId } = await req.json()

    if (!dealId) {
      return NextResponse.json({ error: 'ডিল আইডি প্রদান করুন' }, { status: 400 })
    }

    const deal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (deal.status !== 'payment_verified') {
      return NextResponse.json(
        { error: 'শুধুমাত্র ভেরিফাইড ডিল ডেলিভারি করা যায়' },
        { status: 400 }
      )
    }

    const updated = await db.deal.update({
      where: { id: dealId },
      data: { status: 'in_delivery' },
      include: {
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    })

    // Email: delivery started — notify buyer
    if (updated.buyer?.email) {
      sendEmail(updated.buyer.email, deliveryStartedEmail(
        updated.buyer.name || 'ক্রেতা',
        deal.title,
        updated.amount || 0,
        deal.seller?.name || 'বিক্রেতা',
      )).catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ডেলিভারি আপডেটে সমস্যা' }, { status: 500 })
  }
}