import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { sendEmail, dealCompletedEmail } from '@/lib/email'
import { sendWhatsApp, dealCompletedWa } from '@/lib/whatsapp'
import { notifyUser } from '@/lib/push'
import { sendDeliveryReminder, REMINDER_WAIT_MS } from '@/lib/delivery-reminder'

export const dynamic = 'force-dynamic'

/**
 * Auth for the cron hit. Vercel's scheduler sends
 * `Authorization: Bearer $CRON_SECRET` automatically. A `?secret=` query
 * param is also accepted so the flow can be verified from a real browser —
 * midman.bd's deployment challenge blocks curl-style clients, but a human
 * opening the URL passes it. Both are compared to CRON_SECRET; when
 * CRON_SECRET is unset the endpoint stays open (safe: it only ever touches
 * deals past their grace window and one-shot-stamps reminders).
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true
  const provided = new URL(req.url).searchParams.get('secret') || ''
  if (provided.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
}

/**
 * GET /api/cron/auto-complete-deals — nightly, fully zero-touch unresponsive-
 * buyer resolution. Two passes:
 *
 * Pass 1 (auto-reminder): seller delivered → 3 days passed → buyer still silent
 * → nobody sent the reminder yet (seller forgot / never pressed the button) →
 * send the buyer reminder email SYSTEM-side and stamp `reminderEmailSentAt`
 * + `autoCompleteAt = now + 30 days`. Legacy deals (delivered before the
 * deliveredAt stamp existed, field = null) are covered too via the updatedAt
 * fallback — same rule the seller's manual button uses.
 *
 * Pass 2 (auto-complete): if the buyer still never clicks "পণ্য/সার্ভিস পেয়েছি"
 * by `autoCompleteAt`, complete the deal so the seller's escrow money doesn't
 * stay held forever.
 *
 * Net effect: deliver → +3d reminder email → +30d auto-complete, with the
 * seller's manual button (POST /api/deals/[id]/send-reminder) as an instant
 * shortcut for the same one-shot flow (shared atomic stamp in
 * sendDeliveryReminder keeps both paths mutually exclusive).
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
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const waitOver = new Date(now.getTime() - REMINDER_WAIT_MS)

  /* ── Pass 1: automatic delivery reminders ────────────────────────
     in_delivery for ≥3 days, nobody reminded yet. Fresh deals measure the
     wait from deliveredAt; legacy deals (delivered before the stamp existed,
     deliveredAt = null) fall back to updatedAt. System-side
     sendDeliveryReminder stamps reminderEmailSentAt + autoCompleteAt (+30d)
     atomically, then emails/notifies the buyer. */
  let reminded = 0
  let remindChecked = 0
  try {
    const remindDue = await db.deal.findMany({
      where: {
        status: 'in_delivery',
        reminderEmailSentAt: null,
        autoCompleteAt: null,
        OR: [
          { deliveredAt: { lte: waitOver } },
          { deliveredAt: null, updatedAt: { lte: waitOver } },
        ],
      },
      take: 200,
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
      },
    })
    remindChecked = remindDue.length

    for (const deal of remindDue) {
      // Per-deal isolation: one bad deal must never abort the whole pass
      try {
        const stamped = await sendDeliveryReminder(deal, 'system')
        if (stamped) reminded++
      } catch (err) {
        console.error(
          `[cron:auto-complete-deals] reminder failed for deal ${deal.id}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
  } catch (err) {
    console.error('[cron:auto-complete-deals] pass1:', err instanceof Error ? err.message : err)
  }

  /* ── Pass 2: auto-complete past the 30-day grace ─────────────────
     Runs independently of Pass 1 — a reminder outage never delays
     completions that are already due. */
  let completed = 0
  let checked = 0
  try {
    const due = await db.deal.findMany({
      where: { status: 'in_delivery', autoCompleteAt: { lte: now } },
      take: 200,
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
      },
    })
    checked = due.length

    for (const deal of due) {
      // Per-deal isolation: one bad deal must never abort the whole pass
      try {
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
      } catch (err) {
        console.error(
          `[cron:auto-complete-deals] complete failed for deal ${deal.id}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
  } catch (err) {
    console.error('[cron:auto-complete-deals] pass2:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({
    success: true,
    remindChecked,
    remindersSent: reminded,
    checked,
    completed,
    checkedAt: now.toISOString(),
  })
}
