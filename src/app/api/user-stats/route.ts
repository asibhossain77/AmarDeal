import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId প্রয়োজন' }, { status: 400 })
    }

    const [activeDeals, completedDeals, totalAmount] = await Promise.all([
      db.deal.count({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          status: { notIn: ['completed', 'rejected'] },
        },
      }),
      db.deal.count({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          status: 'completed',
        },
      }),
      db.deal.aggregate({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          status: 'completed',
        },
        _sum: { amount: true },
      }),
    ])

    return NextResponse.json({
      activeDeals,
      completedDeals,
      totalAmount: totalAmount._sum.amount || 0,
    })
  } catch {
    return NextResponse.json({ error: 'স্ট্যাটস লোড করতে সমস্যা' }, { status: 500 })
  }
}