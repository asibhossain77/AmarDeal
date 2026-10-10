import { db } from '@/lib/db'
import { notifyUser } from '@/lib/push'

/* ═══════════════════════════════════════════════════════════
   Marketplace order payment confirmation — shared, atomic and
   idempotent. Used by:
   - POST /api/marketplace/payment/verify   (gateway, customer-triggered)
   - POST /api/marketplace/payment/webhook  (gateway, server-to-server re-verify)
   - PATCH /api/admin/marketplace/orders/[id] (manual verify action)

   Guarantees:
   - An order is confirmed paid at most once (guarded updateMany).
   - Amount / currency are cross-checked against the gateway's
     trusted verify response before anything is written.
   - Repeated callbacks never duplicate confirmations or events.
   - An unverified or mismatched payment NEVER produces a paid order.
   ═══════════════════════════════════════════════════════════ */

export interface ConfirmPaymentInput {
  orderId: string
  /** Trusted amount from the server-to-server verify response (BDT) */
  amount: number
  currency?: string
  gatewayStatus?: string
  paymentMethodName?: string | null
  senderNumber?: string | null
  transactionId?: string | null
  verifiedBy: string
}

export type ConfirmPaymentResult =
  | { ok: true; alreadyPaid: boolean }
  | { ok: false; error: 'not_found' | 'not_pending' | 'amount_mismatch' | 'currency_mismatch' | 'not_completed' | 'db_error'; detail?: string }

export async function confirmMarketplaceOrderPayment(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const order = await db.marketplaceOrder.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      totalAmount: true,
      status: true,
      paymentStatus: true,
      serviceName: true,
    },
  })

  if (!order) return { ok: false, error: 'not_found' }

  // Idempotent: already confirmed → report success without side effects
  if (order.paymentStatus === 'paid' && order.status !== 'pending_payment') {
    return { ok: true, alreadyPaid: true }
  }

  // The gateway must report a completed payment
  if (input.gatewayStatus && input.gatewayStatus !== 'completed') {
    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'payment_failed',
        message: `Gateway status "${input.gatewayStatus}" is not completed — payment not accepted`,
        actorType: 'system',
      },
    }).catch(() => {})
    return { ok: false, error: 'not_completed', detail: input.gatewayStatus }
  }

  // Currency must be BDT when provided
  if (input.currency && input.currency.toUpperCase() !== 'BDT') {
    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'payment_failed',
        message: `Currency mismatch: expected BDT, received ${input.currency}`,
        actorType: 'system',
      },
    }).catch(() => {})
    return { ok: false, error: 'currency_mismatch' }
  }

  // Amount must match the order total exactly (poisha-exact)
  const expected = Math.round(order.totalAmount * 100)
  const received = Math.round((Number.isFinite(input.amount) ? input.amount : NaN) * 100)
  if (!Number.isFinite(received) || received !== expected) {
    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'payment_failed',
        message: `Amount mismatch: expected ৳${order.totalAmount.toFixed(2)}, received ৳${(received / 100).toFixed(2)} — payment not accepted`,
        actorType: 'system',
      },
    }).catch(() => {})
    return { ok: false, error: 'amount_mismatch' }
  }

  // Atomic guarded transition — only one concurrent caller wins.
  const updated = await db.marketplaceOrder.updateMany({
    where: {
      id: order.id,
      status: 'pending_payment',
      paymentStatus: { in: ['unpaid', 'awaiting_verification'] },
    },
    data: {
      status: 'queued',
      paymentStatus: 'paid',
      paidAt: new Date(),
      paymentVerifiedBy: input.verifiedBy,
      paymentMethodName: input.paymentMethodName || undefined,
      senderNumber: input.senderNumber || undefined,
      transactionId: input.transactionId || undefined,
    },
  })

  if (updated.count === 0) {
    // Someone else transitioned it between our read and write — re-check
    const fresh = await db.marketplaceOrder.findUnique({
      where: { id: order.id },
      select: { paymentStatus: true, status: true },
    })
    if (fresh && fresh.paymentStatus === 'paid' && fresh.status !== 'pending_payment') {
      return { ok: true, alreadyPaid: true }
    }
    return { ok: false, error: 'not_pending' }
  }

  await db.marketplaceOrderEvent.create({
    data: {
      orderId: order.id,
      type: 'payment_verified',
      fromStatus: 'pending_payment',
      toStatus: 'queued',
      message: `Payment verified (৳${order.totalAmount.toFixed(2)}) by ${input.verifiedBy} — order queued for fulfilment`,
      actorType: input.verifiedBy === 'piprapay' ? 'system' : 'admin',
      actorId: input.verifiedBy === 'piprapay' ? null : input.verifiedBy,
      actorName: input.verifiedBy === 'piprapay' ? 'PipraPay Gateway' : undefined,
    },
  }).catch(() => {})

  notifyUser({
    userId: order.userId,
    type: 'order_payment_verified',
    title: 'অর্ডার পেমেন্ট ভেরিফাইড',
    message: `আপনার অর্ডার ${order.orderNumber} (${order.serviceName}) এর পেমেন্ট যাচাই হয়েছে। কাজ শুরু হবে শীঘ্রই।`,
    pushUrl: `/dashboard/orders/${order.id}`,
  }).catch(() => {})

  return { ok: true, alreadyPaid: false }
}
