import { db } from '@/lib/db'
import { sendEmail, deliveryReminderEmail } from '@/lib/email'
import { notifyUser } from '@/lib/push'

export const DAY_MS = 24 * 60 * 60 * 1000
/** Reminder can go out 3 days after the seller marked the work delivered */
export const REMINDER_WAIT_MS = 3 * DAY_MS
/** Deal auto-completes 30 days (~1 month) after the reminder goes out */
export const AUTO_COMPLETE_MS = 30 * DAY_MS

/**
 * Has the 3-day reminder wait elapsed for this deal?
 *
 * Fresh deals are measured from `deliveredAt` (stamped by both deliver
 * routes). Legacy deals — delivered BEFORE the deliveredAt stamp existed —
 * have `deliveredAt = null` and fall back to `updatedAt`, which for an
 * in_delivery deal is the deliver action itself (its last write).
 *
 * Shared by the seller's manual endpoint (send-reminder) and the nightly
 * cron so both paths agree on exactly when the reminder may fire.
 */
export function isReminderWaitOver(deal: {
  deliveredAt: Date | null
  updatedAt: Date
}): boolean {
  const start = deal.deliveredAt ?? deal.updatedAt
  return Date.now() - start.getTime() >= REMINDER_WAIT_MS
}

// Bengali date label used in emails / system messages, e.g. "০৫ অক্টোবর, ২০২৬"
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
function toBnDigits(n: number | string): string {
  const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
  return String(n).replace(/\d/g, (d) => BN[+d])
}
export function bnDateLabel(d: Date): string {
  return `${toBnDigits(d.getDate())} ${BN_MONTHS[d.getMonth()]}, ${toBnDigits(d.getFullYear())}`
}

/** Who triggered the reminder — adjusts only the wording of the system chat message */
export type ReminderSource = 'seller' | 'system'

export interface ReminderDeal {
  id: string
  title: string
  amount: number | null
  buyerId: string
  buyer?: { name?: string | null; email?: string | null } | null
  seller?: { name?: string | null } | null
}

export interface DeliveryReminderResult {
  reminderEmailSentAt: Date
  autoCompleteAt: Date
  chatMessage: {
    id: string
    senderId: string
    role: string | null
    senderName: string | null
    text: string
    createdAt: Date
  } | null
}

/**
 * Stamp `reminderEmailSentAt` + `autoCompleteAt` (= now + 30 days) on a deal
 * and fire the buyer-side side effects: system chat message, notification
 * bell/push, and the reminder email with the Bengali auto-complete date.
 *
 * The guarded updateMany makes this ONE-SHOT even if the daily cron and the
 * seller's manual button race each other — whichever stamps first wins, the
 * loser gets count !== 1, skips every side effect and returns null.
 *
 * Returns null when the deal is no longer in_delivery or was already reminded.
 */
export async function sendDeliveryReminder(
  deal: ReminderDeal,
  source: ReminderSource
): Promise<DeliveryReminderResult | null> {
  const now = new Date()
  const autoCompleteAt = new Date(now.getTime() + AUTO_COMPLETE_MS)

  // Atomic one-shot guard: only stamp while still in_delivery and not yet reminded
  const res = await db.deal.updateMany({
    where: { id: deal.id, status: 'in_delivery', reminderEmailSentAt: null, autoCompleteAt: null },
    data: { reminderEmailSentAt: now, autoCompleteAt },
  })
  if (res.count !== 1) return null

  const autoCompleteLabel = bnDateLabel(autoCompleteAt)
  const chatText =
    source === 'system'
      ? `📧 ডেলিভারি রিমাইন্ডার ইমেইল স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে। ${autoCompleteLabel} এর মধ্যে বয়ার ডেলিভারি নিশ্চিত না করলে ডিলটি স্বয়ংক্রিয়ভাবে সম্পন্ন হয়ে বিক্রেতার পেমেন্ট মুক্ত হবে।`
      : `📧 বিক্রেতা বয়ারকে রিমাইন্ডার ইমেইল পাঠিয়েছেন। ${autoCompleteLabel} এর মধ্যে ডেলিভারি নিশ্চিত না করলে ডিলটি স্বয়ংক্রিয়ভাবে সম্পন্ন হয়ে বিক্রেতার পেমেন্ট মুক্ত হবে।`

  const chatMessage = await db.chatMessage
    .create({
      data: {
        dealId: deal.id,
        senderId: '__system__',
        role: 'system',
        senderName: null,
        text: chatText,
      },
    })
    .catch(() => null)

  // Notify the buyer (notification bell + push)
  if (deal.buyerId) {
    notifyUser({
      userId: deal.buyerId,
      dealId: deal.id,
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
          deal.buyer?.name || 'ক্রেতা',
          deal.title,
          deal.amount || 0,
          deal.seller?.name || 'বিক্রেতা',
          autoCompleteLabel
        ),
      'delivery_reminder'
    ).catch(() => {})
  }

  return {
    reminderEmailSentAt: now,
    autoCompleteAt,
    chatMessage: chatMessage
      ? {
          id: chatMessage.id,
          senderId: chatMessage.senderId,
          role: chatMessage.role,
          senderName: chatMessage.senderName,
          text: chatMessage.text,
          createdAt: chatMessage.createdAt,
        }
      : null,
  }
}
