import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'
import {
  sendDeliveryReminder,
  bnDateLabel,
  REMINDER_WAIT_MS,
} from '@/lib/delivery-reminder'

export const dynamic = 'force-dynamic'

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
 * Seller sends the unresponsive-buyer reminder email manually. Allowed only
 * while the deal is in `in_delivery`, only by the seller, and only after 3
 * days have passed since delivery. One-shot: after sending, the deal gets
 * `autoCompleteAt = sentAt + 30 days` and the daily cron will auto-complete it
 * if the buyer never confirms — so the seller's money doesn't stay held forever.
 *
 * The daily cron (/api/cron/auto-complete-deals) sends the same reminder
 * AUTOMATICALLY at deliveredAt + 3 days when the seller never pressed the
 * button, so the flow no longer stalls if the seller forgets too. This manual
 * endpoint stays for instant delivery at the 3-day mark instead of waiting
 * for the next nightly cron run. Both paths share sendDeliveryReminder(),
 * whose atomic stamp makes them mutually one-shot.
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

    const result = await sendDeliveryReminder(deal, 'seller')
    if (!result) {
      // Lost the atomic race (cron auto-reminded first / deal moved on)
      return NextResponse.json(
        { error: 'রিমাইন্ডার ইমেইল আগেই পাঠানো হয়েছে' },
        { status: 400 }
      )
    }

    // Broadcast the system chat message so live chat sessions see it
    if (result.chatMessage) {
      broadcastChatMessage(id, {
        id: result.chatMessage.id,
        dealId: id,
        senderId: result.chatMessage.senderId,
        role: result.chatMessage.role,
        senderName: result.chatMessage.senderName,
        text: result.chatMessage.text,
        createdAt: result.chatMessage.createdAt,
      })
    }

    return NextResponse.json({
      success: true,
      reminderEmailSentAt: result.reminderEmailSentAt,
      autoCompleteAt: result.autoCompleteAt,
      autoCompleteLabel: bnDateLabel(result.autoCompleteAt),
    })
  } catch {
    return NextResponse.json({ error: 'রিমাইন্ডার পাঠাতে সমস্যা' }, { status: 500 })
  }
}
