import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCompletedEmail } from '@/lib/email'
import { requireAuth } from '@/lib/deal-guard'
import { processAffiliateCommission } from '@/lib/affiliate-commission'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const { dealId } = await req.json()

    if (!dealId) {
      return NextResponse.json({ error: 'ডিল আইডি প্রদান করুন' }, { status: 400 })
    }

    const deal = await db.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (deal.status !== 'in_delivery') {
      return NextResponse.json(
        { error: 'শুধুমাত্র ডেলিভারি পর্যায়ের ডিল সম্পন্ন করা যায়' },
        { status: 400 }
      )
    }

    const updated = await db.deal.update({
      where: { id: dealId },
      data: { status: 'completed' },
      include: {
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    })

    // Email: deal completed
    if (updated.buyer?.email) {
      sendEmail(updated.buyer.email, () => dealCompletedEmail(updated.buyer.name || 'ক্রেতা', deal.title, updated.amount || 0, 'buyer'), 'deal_completed').catch(() => {})
    }
    if (updated.seller?.email) {
      sendEmail(updated.seller.email, () => dealCompletedEmail(updated.seller.name || 'বিক্রেতা', deal.title, updated.amount || 0, 'seller'), 'deal_completed').catch(() => {})
    }

    // Process affiliate commission (fire-and-forget)
    processAffiliateCommission(dealId).catch(() => {})

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ডিল সম্পন্ন করতে সমস্যা' }, { status: 500 })
  }
}