import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/** POST — mark an approved seller withdrawal as completed/money sent (approved → completed) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response
    const { id } = await params

    const withdrawal = await db.sellerWithdrawal.findUnique({ where: { id } })
    if (!withdrawal) {
      return NextResponse.json({ error: 'উত্তোলন পাওয়া যায়নি' }, { status: 404 })
    }
    if (withdrawal.status !== 'approved') {
      return NextResponse.json(
        { error: `শুধু approved উত্তোলন সম্পন্ন করা যায় (বর্তমানে ${withdrawal.status})` },
        { status: 400 }
      )
    }

    const updated = await db.sellerWithdrawal.update({
      where: { id },
      data: { status: 'completed' },
    })

    return NextResponse.json({
      success: true,
      message: 'উত্তোলন সম্পন্ন হয়েছে — টাকা পাঠানো হয়েছে',
      withdrawal: updated,
    })
  } catch (err) {
    console.error('[SELLER WD COMPLETE ERROR]', err)
    return NextResponse.json({ error: 'সম্পন্ন করতে সমস্যা' }, { status: 500 })
  }
}
