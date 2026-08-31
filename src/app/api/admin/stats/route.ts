import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/**
 * GET /api/admin/stats
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const [totalDeals, totalUsers, pendingVerification, pendingPayouts, completedSum, profitSum, adminCalls, disputedCount, pendingProducts] = await Promise.all([
      db.deal.count(),

      db.user.count(),

      db.deal.count({
        where: {
          status: 'payment_pending',
        },
      }),

      db.payout.count({
        where: { status: 'pending' },
      }),

      db.deal.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      }),

      db.deal.aggregate({
        where: { status: 'completed' },
        _sum: { platformFee: true },
      }),

      db.deal.count({
        where: { adminCalled: true },
      }),

      db.deal.count({
        where: { status: 'disputed' },
      }),

      db.digitalProduct.count({
        where: { status: 'pending' },
      }),
    ])

    return NextResponse.json({
      totalDeals,
      totalUsers,
      pendingVerification,
      pendingPayouts,
      completedAmount: Math.round(completedSum._sum.amount || 0),
      totalProfit: Math.round(profitSum._sum.platformFee || 0),
      adminCalls,
      disputedCount,
      pendingProducts,
    })
  } catch {
    return NextResponse.json(
      { error: 'স্ট্যাটস লোড করতে সমস্যা হয়েছে' },
      { status: 500 },
    )
  }
}