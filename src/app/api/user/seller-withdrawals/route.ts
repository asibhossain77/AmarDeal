import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { getSellerBalance } from '@/lib/seller-balance'
import { sendEmail, payoutRequestedEmail } from '@/lib/email'
import { sendWhatsApp, payoutRequestedWa } from '@/lib/whatsapp'

const VALID_ACCOUNT_TYPES = ['bkash', 'nagad', 'rocket', 'bank']
const MIN_WITHDRAWAL = 100

/**
 * GET — seller's live balance + withdrawal history.
 * Balance is computed server-side from completed deals, legacy per-deal
 * payouts and previous withdrawals. The client never sends amounts.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const [balance, withdrawals] = await Promise.all([
      getSellerBalance(userId),
      db.sellerWithdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ])

    return NextResponse.json({ balance, withdrawals })
  } catch {
    return NextResponse.json(
      { error: 'ব্যালেন্স লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}

/**
 * POST — request a withdrawal from the accumulated balance.
 * Server re-computes the balance and validates everything; client data is
 * only ever used for the destination account, never for the amount math.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Seller-only (active, not disabled)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, isSeller: true, sellerDisabled: true, isActive: true },
    })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }
    if (!user.isSeller || user.sellerDisabled) {
      return NextResponse.json({ error: 'শুধুমাত্র সেলাররা উত্তোলন করতে পারবেন' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const { amount, accountType, accountNumber, accountName } = body || {}
    if (!amount || !accountType || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'সকল তথ্য প্রদান করুন', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    const numAmount = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'সঠিক পরিমাণ দিন', code: 'INVALID_AMOUNT' },
        { status: 400 }
      )
    }
    if (numAmount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `সর্বনিম্ন উত্তোলন ৳${MIN_WITHDRAWAL}`, code: 'BELOW_MINIMUM' },
        { status: 400 }
      )
    }
    if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
      return NextResponse.json(
        { error: 'অবৈধ একাউন্ট টাইপ', code: 'INVALID_TYPE' },
        { status: 400 }
      )
    }

    // Live balance check — the ONLY source of truth for the amount
    const balance = await getSellerBalance(userId)
    if (numAmount > balance.available) {
      return NextResponse.json(
        { error: 'পর্যাপ্ত ব্যালেন্স নেই', code: 'INSUFFICIENT_BALANCE', available: balance.available },
        { status: 400 }
      )
    }

    // Anti-spam: one in-process withdrawal at a time
    const activeWd = await db.sellerWithdrawal.findFirst({
      where: { userId, status: { in: ['pending', 'approved'] } },
    })
    if (activeWd) {
      return NextResponse.json(
        { error: 'একটি উত্তোলন ইতিমধ্যে প্রসেসিং আছে। সম্পন্ন হলে আবার চেষ্টা করুন।', code: 'PENDING_EXISTS' },
        { status: 409 }
      )
    }

    const withdrawal = await db.sellerWithdrawal.create({
      data: {
        userId,
        amount: numAmount,
        accountType,
        accountNumber: String(accountNumber).trim(),
        accountName: String(accountName).trim(),
      },
    })

    // Email + WhatsApp notification (reuses existing payout-request templates)
    const wdTitle = 'ব্যালেন্স উত্তোলন'
    if (user.email) {
      sendEmail(user.email, () => payoutRequestedEmail(
        user.name || 'ইউজার',
        wdTitle,
        numAmount,
        accountType,
        String(accountNumber).trim(),
        'seller_payout',
      ), 'payout_requested').catch(() => {})
    }
    if (user.phone) {
      sendWhatsApp(user.phone, () => ({ body: payoutRequestedWa(
        user.name || 'ইউজার',
        wdTitle,
        numAmount,
        accountType,
        String(accountNumber).trim(),
        'seller_payout',
      ) }), 'payout_requested').catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message: 'উত্তোলন অনুরোধ সফলভাবে জমা হয়েছে',
      withdrawal,
      balance: { ...balance, available: Math.max(0, balance.available - numAmount) },
    })
  } catch {
    return NextResponse.json(
      { error: 'উত্তোলন অনুরোধ করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}
