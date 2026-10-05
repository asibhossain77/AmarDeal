import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { isMissingProductOptionsSupportError } from '@/lib/prisma-column-safe'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const user = await db.user.findUnique({ where: { id: userId }, select: { isSeller: true } })
    if (!user?.isSeller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    let products
    try {
      products = await db.digitalProduct.findMany({
        where: { sellerId: userId },
        include: {
          options: {
            select: { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (err) {
      if (!isMissingProductOptionsSupportError(err)) throw err
      // ProductOption support not migrated yet (production) — fall back without options
      products = await db.digitalProduct.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: 'desc' },
      })
    }

    return NextResponse.json({ products })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
