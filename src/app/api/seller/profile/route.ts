import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, imageLink: true, isSeller: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const application = await db.sellerApplication.findFirst({
      where: { userId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      select: { businessName: true, email: true, phone: true, approvedAt: undefined as any },
    })

    const productCount = await db.digitalProduct.count({ where: { sellerId: userId } })

    return NextResponse.json({
      user,
      business: application ? { name: application.businessName, email: application.email, phone: application.phone } : null,
      productCount,
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
