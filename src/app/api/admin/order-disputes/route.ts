import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/order-disputes — marketplace order dispute inbox.
   (Separate from the Deal 'disputes' panel — this covers ONLY
   direct marketplace orders.) Filters: status, q.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    const q = (searchParams.get('q') || '').trim()

    const where: Record<string, unknown> = {}
    if (['open', 'under_review', 'resolved', 'rejected'].includes(status)) {
      where.status = status
    }
    if (q) {
      where.order = {
        OR: [
          { orderNumber: { contains: q } },
          { serviceName: { contains: q } },
          { user: { is: { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } } },
        ],
      }
    }

    const disputes = await db.orderDispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: {
          select: {
            id: true, orderNumber: true, serviceName: true, status: true,
            paymentStatus: true, totalAmount: true, createdAt: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
            seller: { select: { id: true, name: true } },
            product: { select: { itemType: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    })

    const [openCount, underReviewCount, resolvedCount, rejectedCount] = await Promise.all([
      db.orderDispute.count({ where: { status: 'open' } }),
      db.orderDispute.count({ where: { status: 'under_review' } }),
      db.orderDispute.count({ where: { status: 'resolved' } }),
      db.orderDispute.count({ where: { status: 'rejected' } }),
    ])

    return NextResponse.json({
      disputes,
      stats: { openCount, underReviewCount, resolvedCount, rejectedCount },
    })
  } catch (err) {
    console.error('[admin-order-disputes LIST ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
