import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import {
  checkOrderTransition,
  grantDigitalEntitlementOnComplete,
  isOrderAction,
  notifyBuyerOrderUpdate,
  notifySellerOrderUpdate,
  restorePhysicalStockOnCancel,
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
   Phase 5 delivery flow:
   - ship:             seller/admin — processing + paid physical
                       order + courier name + tracking number → shipped
   - out_for_delivery: seller/admin — shipped physical order
   - mark_delivered:   seller/admin — shipped/out_for_delivery
                       physical order WITH a tracking record on file
                       (no tracking proof → no delivery claim)
   - deliver_digital:  seller/admin — processing digital order →
                       delivered (secure handover content stored
                       order-scoped; file products get download access)
   - confirm_receipt:  buyer — delivered order → completed
   A buyer can NEVER start, complete, ship, or mark an order paid —
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
    const body = await req.json().catch(() => ({})) as {
      action?: string
      reason?: string
      courierName?: string
      trackingNumber?: string
      dispatchDate?: string
      estimatedDeliveryDate?: string
      shippingNote?: string
      deliveryContent?: string
    }
    const { action, reason } = body

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
        disputeReason: true,
        // ── Phase 5: delivery-flow gating fields ──
        trackingNumber: true,
        product: { select: { itemType: true, fileKey: true } },
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

    const check = checkOrderTransition(
      {
        ...order,
        itemType: order.product?.itemType ?? null,
        productHasFile: !!order.product?.fileKey,
      },
      action as OrderAction,
      role,
      reason,
      {
        courierName: body.courierName,
        trackingNumber: body.trackingNumber,
        dispatchDate: body.dispatchDate,
        estimatedDeliveryDate: body.estimatedDeliveryDate,
        shippingNote: body.shippingNote,
        deliveryContent: body.deliveryContent,
      },
    )
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
        disputeReason: true,
        // ── Phase 5: delivery tracking fields (echoed back to the UI) ──
        courierName: true,
        trackingNumber: true,
        dispatchDate: true,
        estimatedDeliveryDate: true,
        shippingNote: true,
        deliveredAt: true,
        deliveryContentAt: true,
      },
    })

    // ── Audit trail (same event log the SMM order flow uses) ──
    const isContentUpdateOnly = action === 'deliver_digital' && updated.status === order.status
    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: isContentUpdateOnly ? 'delivery_updated' : 'status_changed',
        fromStatus: order.status,
        toStatus: updated.status,
        message:
          action === 'ship'
            ? `কুরিয়ার: ${updated.courierName} · ট্র্যাকিং: ${updated.trackingNumber}`
            : action === 'out_for_delivery'
              ? 'ডেলিভারির পথে চিহ্নিত করা হয়েছে'
              : action === 'mark_delivered'
                ? 'ডেলিভারি সম্পন্ন — কুরিয়ার নিশ্চিতকৃত'
                : action === 'deliver_digital'
                  ? isContentUpdateOnly
                    ? 'ডিজিটাল ডেলিভারি কনটেন্ট হালনাগাদ করা হয়েছে'
                    : 'ডিজিটাল কনটেন্ট ডেলিভারি দেওয়া হয়েছে — অর্ডার পেজ থেকে সংগ্রহ করুন'
                  : action === 'confirm_receipt'
                    ? 'ক্রেতা অর্ডার গ্রহণ নিশ্চিত করেছেন'
                    : action === 'cancel'
                      ? (updated.cancelReason || `Order cancelled by ${role}`)
                      : action === 'start'
                        ? 'Seller started fulfilment'
                        : action === 'dispute'
                          ? (updated.disputeReason || `Dispute opened by ${role}`)
                          : action === 'resolve_complete'
                            ? 'Admin resolved dispute — order completed'
                            : action === 'resolve_cancel'
                              ? (updated.cancelReason || 'Admin resolved dispute — order cancelled')
                              : 'Order marked completed',
        actorType: role,
        actorId: userId,
      },
    }).catch(() => {})

    // ── Post-transition side effects ──
    if (action === 'complete' || action === 'resolve_complete' || action === 'deliver_digital') {
      // paid digital-file order → grant the buyer download entitlement
      // (Phase 5: granted on DELIVERY, not only on legacy completion)
      await grantDigitalEntitlementOnComplete(order.productId, order.userId)
    }
    if (action === 'cancel' || action === 'resolve_cancel') {
      // physical order cancelled → the reserved stock units go back
      await restorePhysicalStockOnCancel(order.productId, updated.quantity)
    }

    // Notify the counterpart(s) — never the actor themself
    const buyerExtra =
      action === 'ship'
        ? `কুরিয়ার: ${updated.courierName}, ট্র্যাকিং: ${updated.trackingNumber} — অর্ডার পেজে বিস্তারিত দেখুন।`
        : action === 'deliver_digital'
          ? 'ডিজিটাল কনটেন্ট অর্ডার পেজে সুরক্ষিতভাবে দেওয়া হয়েছে — শুধু আপনি এটি দেখতে পারবেন।'
          : undefined
    if (role !== 'buyer') {
      await notifyBuyerOrderUpdate({
        id: updated.id,
        userId: order.userId,
        orderNumber: updated.orderNumber,
        productTitle,
        status: updated.status,
        extra: buyerExtra,
      })
    }
    if (role !== 'seller' && order.sellerId) {
      await notifySellerOrderUpdate({
        id: updated.id,
        sellerId: order.sellerId,
        orderNumber: updated.orderNumber,
        productTitle,
        status: updated.status,
        extra: action === 'confirm_receipt' ? 'রিসিপ্ট নিশ্চিত করা হয়েছে।' : undefined,
      })
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (err) {
    console.error('[ORDER STATUS ERROR]', err)
    return NextResponse.json({ error: 'স্ট্যাটাস পরিবর্তনে সমস্যা হয়েছে' }, { status: 500 })
  }
}
