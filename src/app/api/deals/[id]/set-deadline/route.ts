import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { notifyUser } from '@/lib/push'

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

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * POST /api/deals/[id]/set-deadline
 * Seller commits to completing the work within N days. Allowed only while the
 * deal is in `payment_verified` (i.e. buyer paid + admin verified). Re-setting
 * is allowed until delivery starts — the commitment is visible to the buyer as
 * a live countdown in their deal view.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const { id } = await params
    const { days } = await req.json().catch(() => ({}))

    const nDays = Number(days)
    if (!Number.isInteger(nDays) || nDays < 1 || nDays > 90) {
      return NextResponse.json(
        { error: 'দয়া করে ১ থেকে ৯০ এর মধ্যে পূর্ণসংখ্যা দিন সংখ্যা দিন' },
        { status: 400 }
      )
    }

    const deal = await db.deal.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, buyerId: true, sellerId: true },
    })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    // Seller-only action
    if (deal.sellerId !== guard.userId) {
      return NextResponse.json(
        { error: 'আপনি এই ডিলের বিক্রেতা নন' },
        { status: 403 }
      )
    }

    // Only after admin verified the payment, and before delivery starts
    if (deal.status !== 'payment_verified') {
      return NextResponse.json(
        { error: 'শুধুমাত্র পেমেন্ট ভেরিফাইড ডিলে সময়সীমা নির্ধারণ করা যায়' },
        { status: 400 }
      )
    }

    const deadlineAt = new Date(Date.now() + nDays * DAY_MS)

    const updated = await db.deal.update({
      where: { id },
      data: { workDays: nDays, workDeadlineAt: deadlineAt },
    })

    // System message in the deal chat so both parties have a record
    const deadlineLabel = deadlineAt.toLocaleDateString('en', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
    const sysMsg = await db.chatMessage.create({
      data: {
        dealId: id,
        senderId: '__system__',
        role: 'system',
        senderName: null,
        text: `⏱️ বিক্রেতা ${nDays} দিনের মধ্যে কাজ সম্পন্ন করার প্রতিশ্রুতি দিয়েছেন (সময়সীমা: ${deadlineLabel})`,
      },
    }).catch(() => null)

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
        type: 'work_deadline_set',
        title: 'সময়সীমা নির্ধারিত',
        message: `"${deal.title}" ডিলের কাজ বিক্রেতা ${nDays} দিনের মধ্যে সম্পন্ন করবেন।`,
        pushUrl: '/dashboard',
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      workDays: updated.workDays,
      workDeadlineAt: updated.workDeadlineAt,
    })
  } catch {
    return NextResponse.json({ error: 'সময়সীমা নির্ধারণে সমস্যা' }, { status: 500 })
  }
}
