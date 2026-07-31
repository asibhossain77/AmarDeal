import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response
    const { id } = await params
    const { reason } = await req.json().catch(() => ({}))

    const withdrawal = await db.affiliateWithdrawal.findUnique({
      where: { id },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'উত্তোলন পাওয়া যায়নি' }, { status: 404 })
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { error: `এই উত্তোলনটি ইতিমধ্যে ${withdrawal.status} অবস্থায় আছে` },
        { status: 400 }
      )
    }

    // Reject + refund balance in transaction
    const result = await db.$transaction([
      // Mark withdrawal as rejected
      db.affiliateWithdrawal.update({
        where: { id },
        data: {
          status: 'rejected',
          note: reason || withdrawal.note || 'প্রশাসক দ্বারা প্রত্যাখ্যাত',
        },
      }),
      // Refund balance to user
      db.user.update({
        where: { id: withdrawal.userId },
        data: { affiliateBalance: { increment: withdrawal.amount } },
      }),
      // Revert earnings status back to pending
      db.affiliateEarning.updateMany({
        where: {
          affiliateId: withdrawal.userId,
          status: 'paid',
        },
        data: { status: 'pending' },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'উত্তোলন প্রত্যাখ্যাত হয়েছে এবং ব্যালেন্স ফেরত দেওয়া হয়েছে',
      withdrawal: result[0],
    })
  } catch (err) {
    console.error('[REJECT WITHDRAWAL ERROR]', err)
    return NextResponse.json({ error: 'প্রত্যাখ্যানে সমস্যা' }, { status: 500 })
  }
}
