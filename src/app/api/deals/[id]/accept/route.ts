import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCompletedEmail } from '@/lib/email'
import { sendWhatsApp, dealCompletedWa } from '@/lib/whatsapp'
import { requireDealAccess } from '@/lib/deal-guard'
import { notifyUser } from '@/lib/push'

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
      await notifyUser({
        userId: deal.sellerId,
        dealId: deal.id,
        type: 'deal_completed',
        title: 'ডিল সম্পন্ন',
        message: `"${deal.title}" ডিলটি সফলভাবে সম্পন্ন হয়েছে। পেমেন্ট আপনার অ্যাকাউন্টে প্রক্রিয়া হচ্ছে।`,
        pushUrl: '/dashboard',
      }).catch(() => {})
    }

    // Email: deal accepted (completed)
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, () => dealCompletedEmail(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, 'buyer'), 'deal_created').catch(() => {})
    }
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, () => dealCompletedEmail(deal.seller.name || 'বিক্রেতা', deal.title, deal.amount || 0, 'seller'), 'deal_created').catch(() => {})
    }

    // WhatsApp: deal completed
    if (deal.buyer?.phone) {
      sendWhatsApp(deal.buyer.phone, () => ({ body: dealCompletedWa(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, 'buyer') }), 'deal_completed').catch(() => {})
    }
    if (deal.seller?.phone) {
      sendWhatsApp(deal.seller.phone, () => ({ body: dealCompletedWa(deal.seller.name || 'বিক্রেতা', deal.title, deal.amount || 0, 'seller') }), 'deal_completed').catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ডিল গ্রহণে সমস্যা' }, { status: 500 })
  }
}