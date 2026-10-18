import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { isOrderStatus } from '@/lib/orders'
import { OPEN_ORDER_STATUSES, FULFILMENT_STATUSES } from '@/lib/orders'

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/orders — admin oversight of PRODUCT orders
   ("Order Now" purchases; serviceId null, productId set).

   ADMIN-ONLY (requireAdmin). The SMM service direct orders keep
   living in GET /api/admin/marketplace/orders + the services panel
   Orders tab — this endpoint complements it for product orders.

   ?platformOwned=1 → only orders whose seller holds an Admin record
   ?platformOwned=0 → only orders sold by regular sellers
   ?status=, ?q=, ?sort=, ?page=, ?pageSize= filters.

   Per-status counts are computed over the FULL (unfiltered) product
   order set so the summary cards show true totals.
   Mutations (verify/reject/set_status/note) go through the existing
   PATCH /api/admin/marketplace/orders/[id] — one action endpoint
   for every marketplace order type.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get('status')
    const platformOwned = searchParams.get('platformOwned')
    const q = (searchParams.get('q') || '').trim().slice(0, 80)
    const sort = searchParams.get('sort') || 'newest'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(5, parseInt(searchParams.get('pageSize') || '20', 10) || 20))

    // Product orders only — service orders are the services panel's domain.
    const baseWhere: Record<string, unknown> = {
      productId: { not: null },
    }

    if (platformOwned === '1') {
      baseWhere.seller = { is: { admin: { isNot: null } } }
    } else if (platformOwned === '0') {
      baseWhere.seller = { is: { admin: null } }
    }

    const where: Record<string, unknown> = { ...baseWhere }
    if (statusParam && statusParam !== 'all') {
      if (statusParam === 'open') {
        where.status = { in: [...OPEN_ORDER_STATUSES] }
      } else if (isOrderStatus(statusParam)) {
        where.status = statusParam
      }
    }

    if (q) {
      where.OR = [
        { orderNumber: { contains: q } },
        { serviceName: { contains: q } },
        { product: { is: { title: { contains: q } } } },
        { user: { is: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } } },
        { seller: { is: { name: { contains: q } } } },
        { transactionId: { contains: q } },
      ]
    }

    const orderBy =
      sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : sort === 'amount_desc'
          ? { totalAmount: 'desc' as const }
          : sort === 'amount_asc'
            ? { totalAmount: 'asc' as const }
            : { createdAt: 'desc' as const }

    const [orders, total] = await Promise.all([
      db.marketplaceOrder.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          quantity: true,
          unitPriceAtOrder: true,
          totalAmount: true,
          serviceName: true,
          createdAt: true,
          option: { select: { name: true } },
          product: { select: { id: true, title: true, image: true, category: true, fileKey: true, productType: true } },
          user: { select: { id: true, name: true, imageLink: true } },
          seller: { select: { id: true, name: true, imageLink: true, admin: { select: { userId: true } } } },
        },
      }),
      db.marketplaceOrder.count({ where }),
    ])

    // Counts over the FULL product-order set (scope-independent cards)
    const group = await db.marketplaceOrder.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    })
    const byStatus = new Map(group.map((g) => [g.status, g._count._all]))
    const counts = {
      total: [...byStatus.values()].reduce((a, b) => a + b, 0),
      pending: OPEN_ORDER_STATUSES.reduce((a, s) => a + (byStatus.get(s) ?? 0), 0),
      processing: FULFILMENT_STATUSES.reduce((a, s) => a + (byStatus.get(s) ?? 0), 0),
      completed: byStatus.get('completed') ?? 0,
      cancelled: byStatus.get('cancelled') ?? 0,
      refunded: byStatus.get('refunded') ?? 0,
    }

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        quantity: o.quantity,
        unitPriceAtOrder: o.unitPriceAtOrder,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        optionName: o.option?.name ?? null,
        isPlatformOwned: !!o.seller?.admin,
        // hasFile derived server-side — fileKey never leaves the server
        product: {
          id: o.product?.id ?? '',
          title: o.product?.title ?? o.serviceName,
          image: o.product?.image ?? null,
          category: o.product?.category,
          hasFile: !!o.product?.fileKey,
        },
        buyer: { id: o.user.id, name: o.user.name, imageLink: o.user.imageLink },
        seller: o.seller
          ? { id: o.seller.id, name: o.seller.name, imageLink: o.seller.imageLink }
          : null,
      })),
      counts,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
    })
  } catch (err) {
    console.error('[ADMIN-ORDER-LIST] GET error:', err)
    return NextResponse.json({ error: 'অর্ডার লোড করা যায়নি' }, { status: 500 })
  }
}
