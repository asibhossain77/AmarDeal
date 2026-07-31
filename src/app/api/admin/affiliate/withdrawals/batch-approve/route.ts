import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const { ids } = await req.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'আইডি তালিকা প্রদান করুন' }, { status: 400 })
    }

    // Approve all pending withdrawals matching the given IDs
    const result = await db.affiliateWithdrawal.updateMany({
      where: {
        id: { in: ids },
        status: 'pending',
      },
      data: { status: 'approved' },
    })

    return NextResponse.json({
      success: true,
      message: `${result.count}টি উত্তোলন অনুমোদিত হয়েছে`,
      updatedCount: result.count,
    })
  } catch (err) {
    console.error('[BATCH APPROVE ERROR]', err)
    return NextResponse.json({ error: 'ব্যাচ অনুমোদনে সমস্যা' }, { status: 500 })
  }
}
