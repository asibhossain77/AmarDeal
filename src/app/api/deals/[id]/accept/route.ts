import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCompletedEmail } from '@/lib/email'
import { requireDealAccess } from '@/lib/deal-guard'

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

    if (deal.status !== 'in_delivery') {
      return NextResponse.json(
        { error: 'শুধুমাত্র ডেলিভারি চলমান ডিল গ্রহণ করা যাবে' },
        { status: 400 }
      )
    }

    if (deal.buyerId !== userId) {
      return NextResponse.json({ error: 'আপনি এই ডিলের ক্রেতা নন' }, { status: 403 })
    }

    const updated = await db.deal.update({
      where: { id },
      data: { status: 'completed' },
    })

    // Notify seller that deal is completed
    if (deal.sellerId) {
      await db.notification.create({
        data: {
          userId: deal.sellerId,
          type: 'deal_completed',
          title: 'ডিল সম্পন্ন',
          message: `"${deal.title}" ডিলটি সফলভাবে সম্পন্ন হয়েছে। পেমেন্ট আপনার অ্যাকাউন্টে প্রক্রিয়া হচ্ছে।`,
          dealId: deal.id,
        },
      })

      try {
        await fetch(`http://localhost:3004/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: deal.sellerId,
            notification: {
              type: 'deal_completed',
              title: 'ডিল সম্পন্ন',
              message: `"${deal.title}" ডিলটি সফলভাবে সম্পন্ন হয়েছে।`,
              dealId: deal.id,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      } catch { /* silent */ }
    }

    // Email: deal accepted (completed)
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, () => dealCompletedEmail(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, 'buyer')).catch(() => {})
    }
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, () => dealCompletedEmail(deal.seller.name || 'বিক্রেতা', deal.title, deal.amount || 0, 'seller')).catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ডিল গ্রহণে সমস্যা' }, { status: 500 })
  }
}