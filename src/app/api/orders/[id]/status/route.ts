import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import {
  checkOrderTransition,
  grantDigitalEntitlementOnComplete,
  isOrderAction,
  notifyBuyerOrderUpdate,
  notifySellerOrderUpdate,
  type OrderAction,
} from '@/lib/orders'

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/orders/[id]/status — product-order actions.

   Server-side rules (see checkOrderTransition):
   - start:    seller (owner) or admin, ONLY on verified-payment
               (queued + paid) orders → processing
   - complete: seller (owner) or admin, ONLY on verified-payment
               (processing + paid) orders → completed
   - cancel:   buyer → own unpaid order; seller → own unpaid order;
               admin → pending_payment orders
   A buyer can NEVER start, complete, or mark an order paid —
   payment truth comes only from the existing verification
   mechanism (admin verify_payment). Admin refunds/cancellations of
   paid orders go through PATCH /api/admin/marketplace/orders/[id].
   ═══════════════════════════════════════════════════════════════ */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { action, reason } = body as { action?: string; reason?: string }

    if (!isOrderAction(action)) {
      return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
    }

    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        userId: true,
        sellerId: true,
        productId: true,
        orderNumber: true,
        serviceName: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'অর্ডার পাওয়া যায়নি', code: 'ORDER_NOT_FOUND' }, { status: 404 })
    }
    if (!order.productId) {
      // This endpoint handles product orders only — service orders use the
      // existing admin fulfilment routes.
      return NextResponse.json({ error: 'অবৈধ অর্ডার টাইপ', code: 'INVALID_ORDER_TYPE' }, { status: 400 })
    }

    // ── Determine actor role (server-side, never client-claimed) ──
    let role: 'buyer' | 'seller' | 'admin' | null = null
    if (order.userId === userId) role = 'buyer'
    else if (order.sellerId === userId) role = 'seller'
    else {
      const admin = await db.admin.findUnique({ where: { userId }, select: { userId: true } })
      if (admin) role = 'admin'
    }
    if (!role) {
      return NextResponse.json(
        { error: 'এই অর্ডারের অনুমতি নেই', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    const check = checkOrderTransition(order, action as OrderAction, role, reason)
    if (!check.ok || !check.data) {
      return NextResponse.json(
        { error: check.error ?? 'অনুমোদিত নয়', code: check.code },
        { status: check.code === 'FORBIDDEN' ? 403 : 409 },
      )
    }

    const data = { ...check.data } as Record<string, unknown>

    const product = await db.digitalProduct.findUnique({
      where: { id: order.productId },
      select: { title: true },
    })
    const productTitle = product?.title ?? order.serviceName ?? order.orderNumber

    const updated = await db.marketplaceOrder.update({
      where: { id: order.id },
      data,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        quantity: true,
        unitPriceAtOrder: true,
        totalAmount: true,
        createdAt: true,
        completedAt: true,
        cancelledAt: true,
        cancelReason: true,
      },
    })

    // ── Audit trail (same event log the SMM order flow uses) ──
    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'status_changed',
        fromStatus: order.status,
        toStatus: updated.status,
        message:
          action === 'cancel'
            ? (updated.cancelReason || `Order cancelled by ${role}`)
            : action === 'start'
              ? 'Seller started fulfilment'
              : 'Order marked completed',
        actorType: role,
        actorId: userId,
      },
    }).catch(() => {})

    // ── Post-transition side effects ──
    if (action === 'complete') {
      // paid digital-file order → grant the buyer download entitlement
      await grantDigitalEntitlementOnComplete(order.productId, order.userId)
    }

    // Notify the counterpart(s) — never the actor themself
    if (role !== 'buyer') {
      await notifyBuyerOrderUpdate({
        id: updated.id,
        userId: order.userId,
        orderNumber: updated.orderNumber,
        productTitle,
        status: updated.status,
      })
    }
    if (role !== 'seller' && order.sellerId) {
      await notifySellerOrderUpdate({
        id: updated.id,
        sellerId: order.sellerId,
        orderNumber: updated.orderNumber,
        productTitle,
        status: updated.status,
      })
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (err) {
    console.error('[ORDER STATUS ERROR]', err)
    return NextResponse.json({ error: 'স্ট্যাটাস পরিবর্তনে সমস্যা হয়েছে' }, { status: 500 })
  }
}
