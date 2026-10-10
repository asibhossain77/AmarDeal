import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/marketplace/orders
   All customer Marketplace Direct Orders with filters.
   ADMIN-ONLY — customers use /api/marketplace/orders which is
   hard-scoped to their own rows.
   ═══════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('paymentStatus')
    const search = (searchParams.get('search') || '').trim().slice(0, 80)
    const take = Math.min(Number(searchParams.get('take')) || 50, 200)
    const skip = Math.max(Number(searchParams.get('skip')) || 0, 0)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { serviceName: { contains: search } },
        { transactionId: { contains: search } },
        { user: { is: { email: { contains: search } } } },
        { user: { is: { name: { contains: search } } } },
      ]
    }

    const [orders, total] = await Promise.all([
      db.marketplaceOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          user: { select: { id: true, name: true, email: true } },
          serviceId: true,
          serviceName: true,
          linkUrl: true,
          quantity: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          paymentMethodName: true,
          transactionId: true,
          createdAt: true,
        },
      }),
      db.marketplaceOrder.count({ where }),
    ])

    return NextResponse.json({ success: true, orders, total })
  } catch (err) {
    console.error('[admin-mp-orders] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
