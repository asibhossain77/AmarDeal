import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/cancellations — cancellation request inbox.
   Filters: status (pending|approved|rejected|all), q (order number,
   buyer name/email, product title). Returns rows + counts.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    const q = (searchParams.get('q') || '').trim()

    const where: Record<string, unknown> = {}
    if (['pending', 'approved', 'rejected'].includes(status)) {
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

    const requests = await db.orderCancellationRequest.findMany({
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
      },
    })

    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      db.orderCancellationRequest.count({ where: { status: 'pending' } }),
      db.orderCancellationRequest.count({ where: { status: 'approved' } }),
      db.orderCancellationRequest.count({ where: { status: 'rejected' } }),
    ])

    return NextResponse.json({
      requests,
      stats: { pendingCount, approvedCount, rejectedCount },
    })
  } catch (err) {
    console.error('[admin-cancellations LIST ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
