import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'
import { sendEmail, deliveryReminderEmail } from '@/lib/email'
import { notifyUser } from '@/lib/push'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
const REMINDER_WAIT_MS = 3 * DAY_MS // seller can remind 3 days after delivery
const AUTO_COMPLETE_MS = 30 * DAY_MS // deal auto-completes 30 days after the reminder

// Bengali date label used in emails / system messages, e.g. "০৫ অক্টোবর, ২০২৬"
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
function toBnDigits(n: number | string): string {
  const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
  return String(n).replace(/\d/g, (d) => BN[+d])
}
export function bnDateLabel(d: Date): string {
  return `${toBnDigits(d.getDate())} ${BN_MONTHS[d.getMonth()]}, ${toBnDigits(d.getFullYear())}`
}

// Broadcast chat message to WebSocket service
async function broadcastChatMessage(dealId: string, message: Record<string, unknown>) {
  try {
    await fetch('http://127.0.0.1:3004/chat-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, message }),
    })
  } catch {
    // WebSocket service might be down, silently ignore
  }
}

/**
 * POST /api/deals/[id]/send-reminder
 * Seller sends the unresponsive-buyer reminder email. Allowed only while the
 * deal is in `in_delivery`, only by the seller, and only after 3 days have
 * passed since delivery. One-shot: after sending, the deal gets
 * `autoCompleteAt = sentAt + 30 days` and the daily cron will auto-complete it
 * if the buyer never confirms — so the seller's money doesn't stay held forever.
 */
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
        { error: 'শুধুমাত্র ডেলিভারি চলমান ডিলে রিমাইন্ডার পাঠানো যাবে' },
        { status: 400 }
      )
    }

    if (deal.sellerId !== userId) {
      return NextResponse.json({ error: 'আপনি এই ডিলের বিক্রেতা নন' }, { status: 403 })
    }

    if (deal.reminderEmailSentAt) {
      return NextResponse.json(
        { error: 'রিমাইন্ডার ইমেইল আগেই পাঠানো হয়েছে' },
        { status: 400 }
      )
    }

    const now = new Date()
    const waitOk = deal.deliveredAt
      ? now.getTime() - deal.deliveredAt.getTime() >= REMINDER_WAIT_MS
      : now.getTime() - deal.updatedAt.getTime() >= REMINDER_WAIT_MS // legacy deals w/o deliveredAt
    if (!waitOk) {
      return NextResponse.json(
        { error: 'বয়ারকে রিমাইন্ডার পাঠাতে ডেলিভারির পর কমপক্ষে ৩ দিন অপেক্ষা করতে হবে' },
        { status: 400 }
      )
    }

    const autoCompleteAt = new Date(now.getTime() + AUTO_COMPLETE_MS)
    const autoCompleteLabel = bnDateLabel(autoCompleteAt)

    const updated = await db.deal.update({
      where: { id },
      data: { reminderEmailSentAt: now, autoCompleteAt },
    })

    // System chat message so both parties see it in the deal chat
    const sysMsg = await db.chatMessage
      .create({
        data: {
          dealId: id,
          senderId: '__system__',
          role: 'system',
          senderName: null,
          text: `📧 বিক্রেতা বয়ারকে রিমাইন্ডার ইমেইল পাঠিয়েছেন। ${autoCompleteLabel} এর মধ্যে ডেলিভারি নিশ্চিত না করলে ডিলটি স্বয়ংক্রিয়ভাবে সম্পন্ন হয়ে বিক্রেতার পেমেন্ট মুক্ত হবে।`,
        },
      })
      .catch(() => null)

    if (sysMsg) {
      broadcastChatMessage(id, {
        id: sysMsg.id,
        dealId: id,
        senderId: sysMsg.senderId,
        role: sysMsg.role,
        senderName: sysMsg.senderName,
        text: sysMsg.text,
        createdAt: sysMsg.createdAt,
      })
    }

    // Notify the buyer (notification bell + push)
    if (deal.buyerId) {
      notifyUser({
        userId: deal.buyerId,
        dealId: id,
        type: 'delivery_reminder',
        title: 'ডেলিভারি রিমাইন্ডার',
        message: `"${deal.title}" ডিলের ডেলিভারি এখনো নিশ্চিত করেননি। ${autoCompleteLabel} এর মধ্যে নিশ্চিত না করলে ডিল স্বয়ংক্রিয়ভাবে সম্পন্ন হবে।`,
        pushUrl: '/dashboard',
      }).catch(() => {})
    }

    // Reminder email to the buyer (best-effort)
    if (deal.buyer?.email) {
      sendEmail(
        deal.buyer.email,
        () =>
          deliveryReminderEmail(
            deal.buyer.name || 'ক্রেতা',
            deal.title,
            deal.amount || 0,
            deal.seller?.name || 'বিক্রেতা',
            autoCompleteLabel
          ),
        'delivery_reminder'
      ).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      reminderEmailSentAt: updated.reminderEmailSentAt,
      autoCompleteAt: updated.autoCompleteAt,
    })
  } catch {
    return NextResponse.json({ error: 'রিমাইন্ডার পাঠাতে সমস্যা' }, { status: 500 })
  }
}
