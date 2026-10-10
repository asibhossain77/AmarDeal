import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'
import { parseLinkTypes } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════
   GET /api/marketplace/orders/[id]
   Order details + status history. Access: owner or admin only
   (IDOR protection — everyone else gets 404-style 403).
   Provider internals (providerOrderId) are never sent to the
   customer — only admins see them.
   ═══════════════════════════════════════════════════════════ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        service: {
          select: {
            id: true, name: true, category: true, description: true,
            pricePerThousand: true, minQuantity: true, maxQuantity: true,
            linkTypes: true, deliveryEstimate: true, instructions: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const isAdmin = !!(await getAdminFromRequest(req))
    if (order.userId !== guard.userId && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Customer-safe payload — internal fulfilment fields stripped for owners
    const base = {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      serviceName: order.serviceName,
      service: order.service,
      linkUrl: order.linkUrl,
      linkType: order.linkType,
      quantity: order.quantity,
      pricingUnit: order.pricingUnit,
      unitPriceAtOrder: order.unitPriceAtOrder,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethodName: order.paymentMethodName,
      senderNumber: order.senderNumber,
      transactionId: order.transactionId,
      piprapayInvoiceId: order.piprapayInvoiceId ? true : undefined, // presence only, never the raw value to non-admins
      paidAt: order.paidAt,
      fulfilmentNote: order.fulfilmentNote,
      startCount: order.startCount,
      remains: order.remains,
      providerStatus: order.providerStatus,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      events: order.events.map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        message: e.message,
        actorType: e.actorType,
        actorName: e.actorName,
        createdAt: e.createdAt,
      })),
    }

    if (isAdmin) {
      return NextResponse.json({
        success: true,
        order: {
          ...base,
          providerOrderId: order.providerOrderId,
          providerName: order.providerStatus,
          providerSyncedAt: order.providerSyncedAt,
          providerError: order.providerError,
          paymentMethodId: order.paymentMethodId,
          invoiceId: order.piprapayInvoiceId,
        },
        isAdmin: true,
      })
    }

    return NextResponse.json({ success: true, order: base, isAdmin: false })
  } catch (err) {
    console.error('[marketplace-order-detail] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
