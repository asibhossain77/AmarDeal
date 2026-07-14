import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/user/dashboard-stats
 * Body: { userId: string }
 *
 * Returns per-user metrics:
 *  - totalDeals            : all deals the user is involved in
 *  - activeDeals           : deals in progress
 *  - completedDeals        : deals with status = 'completed'
 *  - totalTransactionAmount: sum of completed deal amounts
 *  - availableBalance      : money received from completed deals (user was seller)
 *  - heldAmount            : money currently in escrow
 *  - totalBalance          : available + held
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId প্রয়োজন' }, { status: 400 })
    }

    const userWhere = {
      OR: [{ buyerId: userId }, { sellerId: userId }, { creatorId: userId }],
    }

    const activeStatuses = ['created', 'payment_pending', 'payment_verified', 'in_delivery']
    const escrowStatuses = ['payment_verified', 'in_delivery']

    const [
      totalDeals,
      activeDeals,
      completedDeals,
      totalCompletedSum,
      sellerCompletedSum,
      heldSum,
    ] = await Promise.all([
      /* 0. Total deals count */
      db.deal.count({ where: userWhere }),

      /* 1. Active deals count */
      db.deal.count({
        where: { ...userWhere, status: { in: activeStatuses } },
      }),

      /* 2. Completed deals count */
      db.deal.count({
        where: { ...userWhere, status: 'completed' },
      }),

      /* 3. Sum of all completed deal amounts (total transaction volume) */
      db.deal.aggregate({
        where: { ...userWhere, status: 'completed' },
        _sum: { amount: true },
      }),

      /* 4. Available balance = sum of completed deals where user is seller */
      db.deal.aggregate({
        where: { sellerId: userId, status: 'completed' },
        _sum: { amount: true },
      }),

      /* 5. Held amount = sum of escrowed deals where user is involved */
      db.deal.aggregate({
        where: { ...userWhere, status: { in: escrowStatuses } },
        _sum: { amount: true },
      }),
    ])

    const availableBalance = sellerCompletedSum._sum.amount || 0
    const heldAmount = heldSum._sum.amount || 0
    const totalTransactionAmount = totalCompletedSum._sum.amount || 0

    return NextResponse.json({
      totalDeals,
      activeDeals,
      completedDeals,
      totalTransactionAmount: Math.round(totalTransactionAmount),
      availableBalance: Math.round(availableBalance),
      heldAmount: Math.round(heldAmount),
      totalBalance: Math.round(availableBalance + heldAmount),
    })
  } catch {
    return NextResponse.json(
      { error: 'স্ট্যাটস লোড করতে সমস্যা হয়েছে' },
      { status: 500 },
    )
  }
}