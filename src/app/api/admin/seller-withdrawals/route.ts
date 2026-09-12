import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''

    const where: Record<string, string> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const withdrawals = await db.sellerWithdrawal.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const [pendingCount, approvedCount, rejectedCount, completedCount, pendingAmount, completedAmount] =
      await Promise.all([
        db.sellerWithdrawal.count({ where: { status: 'pending' } }),
        db.sellerWithdrawal.count({ where: { status: 'approved' } }),
        db.sellerWithdrawal.count({ where: { status: 'rejected' } }),
        db.sellerWithdrawal.count({ where: { status: 'completed' } }),
        db.sellerWithdrawal.aggregate({ where: { status: { in: ['pending', 'approved'] } }, _sum: { amount: true } }),
        db.sellerWithdrawal.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
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
    console.error('[SELLER WITHDRAWALS LIST ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
