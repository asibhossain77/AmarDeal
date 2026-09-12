import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/** POST — reject a pending seller withdrawal (pending → rejected, balance released back) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response
    const { id } = await params

    const body = await req.json().catch(() => null)
    const reason = (body?.reason as string | undefined)?.trim() || ''

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
      data: { status: 'rejected', adminNote: reason || null },
    })

    return NextResponse.json({
      success: true,
      message: 'উত্তোলন বাতিল করা হয়েছে — ব্যালেন্স ফেরত যোগ হয়েছে',
      withdrawal: updated,
    })
  } catch (err) {
    console.error('[SELLER WD REJECT ERROR]', err)
    return NextResponse.json({ error: 'বাতিল করতে সমস্যা' }, { status: 500 })
  }
}
