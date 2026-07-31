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

    const withdrawal = await db.affiliateWithdrawal.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, phone: true } } },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'উত্তোলন পাওয়া যায়নি' }, { status: 404 })
    }

    if (withdrawal.status !== 'approved') {
      return NextResponse.json(
        { error: 'শুধুমাত্র অনুমোদিত উত্তোলন পেমেন্ট সম্পন্ন করা যাবে' },
        { status: 400 }
      )
    }

    const updated = await db.affiliateWithdrawal.update({
      where: { id },
      data: { status: 'completed' },
    })

    return NextResponse.json({
      success: true,
      message: 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে',
      withdrawal: updated,
    })
  } catch (err) {
    console.error('[COMPLETE WITHDRAWAL ERROR]', err)
    return NextResponse.json({ error: 'পেমেন্ট সম্পন্ন করতে সমস্যা' }, { status: 500 })
  }
}
