import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

const VALID_ACCOUNT_TYPES = ['bkash', 'nagad', 'rocket', 'bank']
const MIN_WITHDRAWAL = 100

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { amount, accountType, accountNumber, accountName, note } = await req.json()

    // Validate required fields
    if (!amount || !accountType || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'সকল তথ্য প্রদান করুন', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // Validate amount
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'সঠিক পরিমাণ দিন', code: 'INVALID_AMOUNT' },
        { status: 400 }
      )
    }

    // Check minimum withdrawal
    if (numAmount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `সর্বনিম্ন উত্তোলন ৳${MIN_WITHDRAWAL}`, code: 'BELOW_MINIMUM' },
        { status: 400 }
      )
    }

    // Validate account type
    if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
      return NextResponse.json(
        { error: 'অবৈধ অ্যাকাউন্ট টাইপ', code: 'INVALID_TYPE' },
        { status: 400 }
      )
    }

    // Fetch user and lock check (read balance)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, affiliateBalance: true, isActive: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }

    if (user.affiliateBalance < numAmount) {
      return NextResponse.json(
        { error: 'পর্যাপ্ত ব্যালেন্স নেই', code: 'INSUFFICIENT_BALANCE' },
        { status: 400 }
      )
    }

    // Check for duplicate pending withdrawal (prevent spam)
    const recentPending = await db.affiliateWithdrawal.findFirst({
      where: { userId, status: 'pending' },
    })
    if (recentPending) {
      return NextResponse.json(
        { error: 'একটি পেন্ডিং উত্তোলন ইতিমধ্যে আছে', code: 'PENDING_EXISTS' },
        { status: 409 }
      )
    }

    // Create withdrawal + deduct balance + mark earnings as paid (in transaction)
    const roundedAmount = Math.round(numAmount * 100) / 100

    const result = await db.$transaction([
      // Deduct from affiliate balance
      db.user.update({
        where: { id: userId },
        data: { affiliateBalance: { decrement: roundedAmount } },
      }),
      // Create withdrawal record
      db.affiliateWithdrawal.create({
        data: {
          userId,
          amount: roundedAmount,
          accountType,
          accountNumber,
          accountName,
          note: note || null,
        },
      }),
      // Mark pending earnings as 'paid' (FIFO — oldest first)
      db.affiliateEarning.updateMany({
        where: { affiliateId: userId, status: 'pending' },
        data: { status: 'paid' },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'উত্তোলন অনুরোধ সফলভাবে জমা হয়েছে',
      withdrawal: result[1],
    })
  } catch {
    return NextResponse.json(
      { error: 'উত্তোলনে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}

/** GET — fetch user's withdrawal history */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const withdrawals = await db.affiliateWithdrawal.findMany({
      where: { userId: guard.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    return NextResponse.json(withdrawals)
  } catch {
    return NextResponse.json({ error: 'তথ্য পেতে সমস্যা' }, { status: 500 })
  }
}
