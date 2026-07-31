import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''

    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const withdrawals = await db.affiliateWithdrawal.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, referralCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Compute summary stats
    const [pendingCount, approvedCount, rejectedCount, completedCount, pendingAmount, completedAmount] =
      await Promise.all([
        db.affiliateWithdrawal.count({ where: { status: 'pending' } }),
        db.affiliateWithdrawal.count({ where: { status: 'approved' } }),
        db.affiliateWithdrawal.count({ where: { status: 'rejected' } }),
        db.affiliateWithdrawal.count({ where: { status: 'completed' } }),
        db.affiliateWithdrawal.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
        db.affiliateWithdrawal.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
      ])

    return NextResponse.json({
      withdrawals,
      stats: {
        pendingCount,
        approvedCount,
        rejectedCount,
        completedCount,
        pendingAmount: pendingAmount._sum.amount || 0,
        completedAmount: completedAmount._sum.amount || 0,
      },
    })
  } catch (err) {
    console.error('[ADMIN AFFILIATE WITHDRAWALS ERROR]', err)
    return NextResponse.json({ error: 'তথ্য পেতে সমস্যা' }, { status: 500 })
  }
}
