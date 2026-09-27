import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, dealCompletedEmail } from '@/lib/email'
import { sendWhatsApp, dealCompletedWa } from '@/lib/whatsapp'
import { notifyUser } from '@/lib/push'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/auto-complete-deals — daily auto-completion of deals where the
 * buyer never confirmed delivery.
 *
 * Flow: seller delivers → 3 days later seller may send the buyer a reminder
 * email (POST /api/deals/[id]/send-reminder) → that stamps
 * `autoCompleteAt = sentAt + 30 days`. If the buyer still never clicks
 * "পণ্য/সার্ভিস পেয়েছি", this cron completes the deal at/after `autoCompleteAt`
 * so the seller's escrow money doesn't stay held forever.
 *
 * Vercel Cron hits this once a day (see vercel.json) and automatically sends
 * `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set.
 * When CRON_SECRET is not configured the endpoint stays open but only ever
 * completes deals that already passed their 30-day grace period, so it is safe.
 *
 * Side effects mirror POST /api/deals/[id]/accept exactly (status → completed,
 * notifications, emails, WhatsApp, system chat message). A guarded
 * updateMany(status = 'in_delivery') makes each deal idempotent even if the
 * cron ever overlaps.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const due = await db.deal.findMany({
      where: { status: 'in_delivery', autoCompleteAt: { lte: new Date() } },
      take: 200,
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    let completed = 0
    for (const deal of due) {
      // Atomic guard: only complete if still in_delivery (idempotent under overlap)
      const res = await db.deal.updateMany({
        where: { id: deal.id, status: 'in_delivery' },
        data: { status: 'completed' },
      })
      if (res.count !== 1) continue
      completed++

      // System chat message (visible to both parties)
      await db.chatMessage
        .create({
          data: {
            dealId: deal.id,
            senderId: '__system__',
            role: 'system',
            senderName: null,
            text: '⏰ বয়ার দীর্ঘদিন ডেলিভারি নিশ্চিত করেননি — ডিলটি স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে। বিক্রেতা এখন পেআউট রিকোয়েস্ট করতে পারবেন।',
          },
        })
        .catch(() => {})

      // Notify both parties
      if (deal.sellerId) {
        notifyUser({
          userId: deal.sellerId,
          dealId: deal.id,
          type: 'deal_completed',
          title: 'ডিল স্বয়ংক্রিয়ভাবে সম্পন্ন',
          message: `"${deal.title}" ডিলটি বয়ারের সাড়া না পাওয়ায় স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে। আপনি এখন পেআউট রিকোয়েস্ট করতে পারেন।`,
          pushUrl: '/dashboard',
        }).catch(() => {})
      }
      notifyUser({
        userId: deal.buyerId,
        dealId: deal.id,
        type: 'deal_completed',
        title: 'ডিল স্বয়ংক্রিয়ভাবে সম্পন্ন',
        message: `আপনি দীর্ঘদিন নিশ্চিত করেননি, তাই "${deal.title}" ডিলটি স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে।`,
        pushUrl: '/dashboard',
      }).catch(() => {})

      // Emails (best-effort)
      const sellerEmail = deal.seller?.email
      const sellerPhone = deal.seller?.phone
      const sellerName = deal.seller?.name || 'বিক্রেতা'
      if (deal.buyer?.email) {
        sendEmail(deal.buyer.email, () => dealCompletedEmail(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, 'buyer'), 'deal_completed').catch(() => {})
      }
      if (sellerEmail) {
        sendEmail(sellerEmail, () => dealCompletedEmail(sellerName, deal.title, deal.amount || 0, 'seller'), 'deal_completed').catch(() => {})
      }

      // WhatsApp (best-effort)
      if (deal.buyer?.phone) {
        sendWhatsApp(deal.buyer.phone, () => ({ body: dealCompletedWa(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0, 'buyer') }), 'deal_completed').catch(() => {})
      }
      if (sellerPhone) {
        sendWhatsApp(sellerPhone, () => ({ body: dealCompletedWa(sellerName, deal.title, deal.amount || 0, 'seller') }), 'deal_completed').catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      checked: due.length,
      completed,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[cron:auto-complete-deals]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: true, completed: 0, note: 'error handled' })
  }
}
