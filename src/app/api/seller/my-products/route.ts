import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const user = await db.user.findUnique({ where: { id: userId }, select: { isSeller: true } })
    if (!user?.isSeller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const products = await db.digitalProduct.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ products })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
  }
}
