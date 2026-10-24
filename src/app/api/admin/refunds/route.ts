import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/refunds — refund request inbox.
   Filters: status, q (order number, buyer name/email, product).
   Returns rows + counts + pending amount.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    const q = (searchParams.get('q') || '').trim()

    const where: Record<string, unknown> = {}
    if (['requested', 'under_review', 'approved', 'rejected', 'processing', 'refunded'].includes(status)) {
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

    const requests = await db.refundRequest.findMany({
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

    const [requestedCount, underReviewCount, approvedCount, rejectedCount, processingCount, refundedCount, refundedAgg, pendingAmountAgg] =
      await Promise.all([
        db.refundRequest.count({ where: { status: 'requested' } }),
        db.refundRequest.count({ where: { status: 'under_review' } }),
        db.refundRequest.count({ where: { status: 'approved' } }),
        db.refundRequest.count({ where: { status: 'rejected' } }),
        db.refundRequest.count({ where: { status: 'processing' } }),
        db.refundRequest.count({ where: { status: 'refunded' } }),
        db.refundRequest.aggregate({ where: { status: 'refunded' }, _sum: { amount: true } }),
        db.refundRequest.aggregate({ where: { status: { in: ['requested', 'under_review', 'approved', 'processing'] } }, _sum: { amount: true } }),
      ])

    return NextResponse.json({
      requests,
      stats: {
        requestedCount,
        underReviewCount,
        approvedCount,
        rejectedCount,
        processingCount,
        refundedCount,
        refundedAmount: refundedAgg._sum.amount || 0,
        pendingAmount: pendingAmountAgg._sum.amount || 0,
      },
    })
  } catch (err) {
    console.error('[admin-refunds LIST ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
