import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/** POST — approve a pending seller withdrawal (pending → approved) */
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
    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { error: `এই উত্তোলনটি ইতিমধ্যে ${withdrawal.status} অবস্থায় আছে` },
        { status: 400 }
      )
    }

    const updated = await db.sellerWithdrawal.update({
      where: { id },
      data: { status: 'approved' },
    })

    return NextResponse.json({
      success: true,
      message: 'উত্তোলন অনুমোদিত হয়েছে',
      withdrawal: updated,
    })
  } catch (err) {
    console.error('[SELLER WD APPROVE ERROR]', err)
    return NextResponse.json({ error: 'অনুমোদনে সমস্যা' }, { status: 500 })
  }
}
