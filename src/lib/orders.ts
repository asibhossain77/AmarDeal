import { db } from '@/lib/db'
import { notifyUser, notifyAdmins } from '@/lib/push'
import { ORDER_STATUSES, PAYMENT_STATUSES } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════════
   Marketplace product orders — shared server-side domain logic.

   Product orders ("Order Now" on a product page) are the NORMAL
   direct-purchase workflow. They are COMPLETELY SEPARATE from the
   Deal (Admin Deal / escrow) workflow: nothing in here ever
   touches db.deal.

   They share ONE table + ONE status vocabulary with the existing
   admin-owned SMM service direct orders (marketplace-pricing.ts):

     status:         pending_payment → queued → processing →
                     in_progress → completed | partial | failed
                     cancelled / refunded (terminal)
     paymentStatus:  unpaid → awaiting_verification → paid | failed

   Product-order specific transitions (this module):
     start     : seller/admin — queued + paid → processing
     complete  : seller/admin — processing + paid → completed
     cancel    : buyer(own) / seller(own) — pending_payment + unpaid
                 admin — pending_payment (any paymentStatus)
   Payment truth ALWAYS comes from the existing verification
   mechanism (admin verify_payment → paid). Nothing here can mark
   an order paid.
   ═══════════════════════════════════════════════════════════════ */

export { ORDER_STATUSES, PAYMENT_STATUSES }

/** Statuses that count as "not yet fulfilled" for the Pending card */
export const OPEN_ORDER_STATUSES: readonly string[] = ['pending_payment']

/** Statuses grouped under the Processing card (paid, in fulfilment) */
export const FULFILMENT_STATUSES: readonly string[] = ['queued', 'processing', 'in_progress', 'shipped', 'out_for_delivery']

/** Phase 5: physical delivery pipeline statuses (product orders only) */
export const DELIVERY_STATUSES: readonly string[] = ['shipped', 'out_for_delivery', 'delivered']

/* ── Quantity guard (product orders) ─────────────────────────── */
export const MAX_ORDER_QTY = 99

export function clampQuantity(v: unknown): number {
  const n = typeof v === 'number' ? Math.floor(v) : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_ORDER_QTY)
}

/* ── Status transition matrix (server-enforced) ──────────────────
   Only these transitions exist. Everything else is rejected with
   409 by the API route — a client cannot invent a new state. */

export type OrderAction = 'start' | 'complete' | 'cancel' | 'dispute' | 'resolve_complete' | 'resolve_cancel'
  // ── Phase 5: delivery tracking actions ──
  | 'ship' | 'out_for_delivery' | 'mark_delivered' | 'deliver_digital' | 'confirm_receipt'

export interface OrderShape {
  id: string
  status: string
  paymentStatus: string
  userId: string
  sellerId: string | null
  productId: string | null
  // ── Phase 5: product classification for delivery-flow gating ──
  itemType?: string | null
  productHasFile?: boolean
  trackingNumber?: string | null
}

/** Phase 5: optional payload for ship / deliver_digital actions */
export interface DeliveryPayload {
  courierName?: string
  trackingNumber?: string
  dispatchDate?: string
  estimatedDeliveryDate?: string
  shippingNote?: string
  deliveryContent?: string
}

export interface TransitionCheck {
  ok: boolean
  code?: string
  error?: string
  /** extra fields to persist on success */
  data?: Record<string, unknown>
}

export function isOrderAction(v: unknown): v is OrderAction {
  return v === 'start' || v === 'complete' || v === 'cancel' || v === 'dispute' || v === 'resolve_complete' || v === 'resolve_cancel'
    || v === 'ship' || v === 'out_for_delivery' || v === 'mark_delivered' || v === 'deliver_digital' || v === 'confirm_receipt'
}

/** Parse a client-supplied date ('yyyy-mm-dd' or ISO) — null when invalid */
function parseDeliveryDate(v: string | undefined): Date | null {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v.length <= 10 ? `${v}T00:00:00.000Z` : v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isOrderStatus(v: unknown): v is string {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)
}

/**
 * Validate a requested product-order transition against the actor's
 * role. Roles: 'buyer' (the order's user), 'seller' (the order's
 * sellerId), 'admin' (verified Admin record — checked by the caller).
 * `payload` carries delivery-flow inputs (Phase 5) — courier info for
 * 'ship', digital handover content for 'deliver_digital'.
 */
export function checkOrderTransition(
  order: OrderShape,
  action: OrderAction,
  role: 'buyer' | 'seller' | 'admin',
  reason?: string,
  payload?: DeliveryPayload,
): TransitionCheck {
  if (action === 'cancel') {
    if (order.status !== 'pending_payment') {
      // paid orders can only be refunded by an admin — never "cancelled"
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'পেমেন্ট হয়ে যাওয়া অর্ডার বাতিল করা যাবে না — রিফান্ডের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন',
      }
    }
    if (role !== 'admin' && order.paymentStatus !== 'unpaid') {
      // buyer/seller cannot cancel once payment evidence is submitted
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'পেমেন্ট যাচাইয়ের অপেক্ষায় থাকা অর্ডার ক্রেতা/বিক্রেতা বাতিল করতে পারবেন না',
      }
    }
    return {
      ok: true,
      data: {
        status: 'cancelled',
        paymentStatus: 'unpaid',
        cancelledAt: new Date(),
        cancelReason: reason?.slice(0, 500) || (role === 'buyer' ? 'customer_cancelled' : 'cancelled_by_seller'),
      },
    }
  }

  if (action === 'start') {
    if (role === 'buyer') {
      return { ok: false, code: 'FORBIDDEN', error: 'শুধু বিক্রেতা অর্ডার প্রসেসিং করতে পারেন' }
    }
    if (order.status !== 'queued') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'পেমেন্ট যাচাই হওয়ার আগে কাজ শুরু করা যাবে না',
      }
    }
    if (order.paymentStatus !== 'paid') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'পেমেন্ট যাচাই ছাড়া অর্ডার প্রসেসিং করা যাবে না',
      }
    }
    return { ok: true, data: { status: 'processing' } }
  }

  if (action === 'complete') {
    if (role === 'buyer') {
      return { ok: false, code: 'FORBIDDEN', error: 'শুধু বিক্রেতা অর্ডার সম্পন্ন করতে পারেন' }
    }
    if (order.status !== 'processing') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'পেমেন্ট যাচাই না হওয়া পর্যন্ত অর্ডার সম্পন্ন করা যাবে না',
      }
    }
    if (order.paymentStatus !== 'paid') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'পেমেন্ট যাচাই ছাড়া অর্ডার সম্পন্ন করা যাবে না',
      }
    }
    return { ok: true, data: { status: 'completed', completedAt: new Date() } }
  }

  // ── Phase 5: delivery tracking flow ──────────────────────────────
  // Physical: processing → shipped (courier+tracking REQUIRED) →
  //           out_for_delivery → delivered → completed (buyer confirms).
  // Digital:  processing → delivered (content or file entitlement).
  // A seller can NEVER mark a physical order delivered without a
  // tracking record, and can never move a state backwards.

  if (action === 'ship') {
    if (role === 'buyer') {
      return { ok: false, code: 'FORBIDDEN', error: 'শুধু বিক্রেতা শিপিং তথ্য দিতে পারেন' }
    }
    if (order.itemType !== 'physical') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'শুধুমাত্র ফিজিক্যাল পণ্যের অর্ডার শিপ করা যায়' }
    }
    if (order.status !== 'processing') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'প্রসেসিং অবস্থার অর্ডারই শুধু শিপ করা যায়' }
    }
    if (order.paymentStatus !== 'paid') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'পেমেন্ট যাচাই ছাড়া অর্ডার শিপ করা যাবে না' }
    }
    const courier = typeof payload?.courierName === 'string' ? payload.courierName.trim() : ''
    const tracking = typeof payload?.trackingNumber === 'string' ? payload.trackingNumber.trim() : ''
    if (!courier) {
      return { ok: false, code: 'COURIER_REQUIRED', error: 'কুরিয়ারের নাম লিখুন' }
    }
    if (!tracking) {
      return { ok: false, code: 'TRACKING_REQUIRED', error: 'ট্র্যাকিং নম্বর লিখুন — এটি ছাড়া শিপিং নিশ্চিত করা যাবে না' }
    }
    return {
      ok: true,
      data: {
        status: 'shipped',
        courierName: courier.slice(0, 80),
        trackingNumber: tracking.slice(0, 80),
        dispatchDate: parseDeliveryDate(payload?.dispatchDate) ?? new Date(),
        estimatedDeliveryDate: parseDeliveryDate(payload?.estimatedDeliveryDate),
        shippingNote: typeof payload?.shippingNote === 'string' ? payload.shippingNote.trim().slice(0, 500) || null : null,
      },
    }
  }

  if (action === 'out_for_delivery') {
    if (role === 'buyer') {
      return { ok: false, code: 'FORBIDDEN', error: 'শুধু বিক্রেতা ডেলিভারি স্ট্যাটাস আপডেট করতে পারেন' }
    }
    if (order.itemType !== 'physical') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'শুধুমাত্র ফিজিক্যাল পণ্যের অর্ডারে প্রযোজ্য' }
    }
    if (order.status !== 'shipped') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'শিপ হওয়ার পরেই ডেলিভারির পথে চিহ্নিত করা যাবে' }
    }
    if (order.paymentStatus !== 'paid') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'পেমেন্ট যাচাই ছাড়া এই পরিবর্তন সম্ভব নয়' }
    }
    return { ok: true, data: { status: 'out_for_delivery' } }
  }

  if (action === 'mark_delivered') {
    if (role === 'buyer') {
      return { ok: false, code: 'FORBIDDEN', error: 'শুধু বিক্রেতা ডেলিভারি নিশ্চিত করতে পারেন' }
    }
    if (order.itemType !== 'physical') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'শুধুমাত্র ফিজিক্যাল পণ্যের অর্ডারে প্রযোজ্য' }
    }
    if (!['shipped', 'out_for_delivery'].includes(order.status)) {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'শিপ বা ডেলিভারির পথে থাকা অর্ডারই শুধু ডেলিভারি হিসেবে চিহ্নিত হবে' }
    }
    if (order.paymentStatus !== 'paid') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'পেমেন্ট যাচাই ছাড়া ডেলিভারি নিশ্চিত করা যাবে না' }
    }
    // Anti-false-delivery validation: a tracking record must exist before
    // an order can be marked delivered — no shipping proof, no delivery.
    if (!order.trackingNumber || !order.trackingNumber.trim()) {
      return {
        ok: false,
        code: 'TRACKING_REQUIRED',
        error: 'ট্র্যাকিং নম্বর ছাড়া ডেলিভারি নিশ্চিত করা যাবে না — আগে শিপিং তথ্য দিন',
      }
    }
    return { ok: true, data: { status: 'delivered', deliveredAt: new Date() } }
  }

  if (action === 'deliver_digital') {
    if (role === 'buyer') {
      return { ok: false, code: 'FORBIDDEN', error: 'শুধু বিক্রেতা ডিজিটাল ডেলিভারি করতে পারেন' }
    }
    if (order.itemType === 'physical') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'ফিজিক্যাল অর্ডারে ডিজিটাল ডেলিভারি প্রযোজ্য নয়' }
    }
    if (order.paymentStatus !== 'paid') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'পেমেন্ট যাচাই ছাড়া ডেলিভারি করা যাবে না' }
    }
    const content = typeof payload?.deliveryContent === 'string' ? payload.deliveryContent.trim() : ''
    if (order.status === 'delivered') {
      // Correction path: seller can replace the delivered content while the
      // order is still awaiting the buyer's receipt confirmation.
      if (!content) {
        return { ok: false, code: 'CONTENT_REQUIRED', error: 'নতুন ডেলিভারি কনটেন্ট লিখুন' }
      }
      return {
        ok: true,
        data: { deliveryContent: content.slice(0, 5000), deliveryContentAt: new Date() },
      }
    }
    if (order.status !== 'processing') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'প্রসেসিং অবস্থার অর্ডারই শুধু ডেলিভার করা যায়' }
    }
    // File products deliver via the download entitlement — content optional.
    // Non-file digital goods (account / license / subscription) REQUIRE the
    // secure handover content, otherwise the buyer receives nothing.
    if (!order.productHasFile && !content) {
      return {
        ok: false,
        code: 'CONTENT_REQUIRED',
        error: 'ডিজিটাল ডেলিভারি কনটেন্ট লিখুন — ফাইল ছাড়া পণ্যের জন্য এটি বাধ্যতামূলক',
      }
    }
    return {
      ok: true,
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        ...(content ? { deliveryContent: content.slice(0, 5000), deliveryContentAt: new Date() } : {}),
      },
    }
  }

  if (action === 'confirm_receipt') {
    if (role === 'seller') {
      return { ok: false, code: 'FORBIDDEN', error: 'গ্রহণ নিশ্চিত করা ক্রেতার কাজ' }
    }
    if (order.status !== 'delivered') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'ডেলিভারি হওয়ার পরেই গ্রহণ নিশ্চিত করা যাবে' }
    }
    if (order.paymentStatus !== 'paid') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'পেমেন্ট যাচাই ছাড়া এই পরিবর্তন সম্ভব নয়' }
    }
    return { ok: true, data: { status: 'completed', completedAt: new Date() } }
  }

  // ── Phase 3: dispute flow ──
  // Buyer (or admin) may open a dispute on a PAID, in-fulfilment order —
  // Phase 5: disputes stay open through the whole delivery pipeline
  // (shipped / out_for_delivery / delivered) until receipt is confirmed.
  // Only an admin can resolve it — sellers cannot resolve or reject
  // disputes on their own, and nobody can dispute an unpaid order
  // (unpaid orders are simply cancelled).
  if (action === 'dispute') {
    if (role === 'seller') {
      return { ok: false, code: 'FORBIDDEN', error: 'বিক্রেতা নিজের অর্ডারে বিরোধ দাখিল করতে পারবেন না' }
    }
    if (!['queued', 'processing', 'in_progress', 'shipped', 'out_for_delivery', 'delivered'].includes(order.status)) {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'এই অর্ডার অবস্থায় বিরোধ দাখিল করা যাবে না',
      }
    }
    if (order.paymentStatus !== 'paid') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        error: 'পেমেন্ট যাচাই না হওয়া অর্ডারে বিরোধ দাখিল হয় না — অর্ডারটি বাতিল করুন',
      }
    }
    if (!reason || !reason.trim()) {
      return { ok: false, code: 'REASON_REQUIRED', error: 'বিরোধের কারণ লিখুন' }
    }
    return {
      ok: true,
      data: { status: 'disputed', disputeReason: reason.trim().slice(0, 500), disputedAt: new Date() },
    }
  }

  if (action === 'resolve_complete' || action === 'resolve_cancel') {
    if (role !== 'admin') {
      return { ok: false, code: 'FORBIDDEN', error: 'বিরোধ মীমাংসা শুধুমাত্র অ্যাডমিন করতে পারবেন' }
    }
    if (order.status !== 'disputed') {
      return { ok: false, code: 'INVALID_TRANSITION', error: 'শুধু বিরোধপূর্ণ অর্ডার মীমাংসা করা যাবে' }
    }
    if (action === 'resolve_complete') {
      return { ok: true, data: { status: 'completed', completedAt: new Date() } }
    }
    return {
      ok: true,
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: 'admin',
        cancelReason: reason?.trim().slice(0, 500) || 'dispute_resolved_cancelled',
      },
    }
  }

  return { ok: false, code: 'INVALID_ACTION', error: 'অজানা অ্যাকশন' }
}

/* ── Notifications (existing infrastructure: DB row + WebSocket + web-push) ── */

export async function notifySellerNewOrder(order: {
  id: string
  orderNumber: string
  sellerId: string
  totalAmount: number
  quantity: number
  productTitle: string
  buyerName?: string | null
  isPlatformOwned: boolean
}): Promise<void> {
  const platformNote = order.isPlatformOwned ? ' (প্ল্যাটফর্ম-নিয়ন্ত্রিত)' : ''
  const title = 'নতুন মার্কেটপ্লেস অর্ডার'
  const message = `"${order.productTitle}" পণ্যের জন্য নতুন অর্ডার (${order.orderNumber}) — ৳${order.totalAmount.toLocaleString('en')}${platformNote}`
  try {
    await notifyUser({
      userId: order.sellerId,
      type: 'order_new',
      title,
      message,
      relatedType: 'order',
      relatedId: order.id,
    })
  } catch { /* notification must never break order creation */ }
}

/** Buyer-facing update on product-order transitions */
export async function notifyBuyerOrderUpdate(order: {
  id: string
  userId: string
  orderNumber: string
  productTitle: string
  status: string
  /** Phase 5: appended detail (courier/tracking, digital handover hint) */
  extra?: string
}): Promise<void> {
  const map: Record<string, { title: string; message: string }> = {
    queued: { title: 'পেমেন্ট যাচাই সম্পন্ন', message: `"${order.productTitle}" অর্ডারের (${order.orderNumber}) পেমেন্ট যাচাই হয়েছে — বিক্রেতা কাজ শুরু করবেন।` },
    processing: { title: 'অর্ডার প্রসেসিং', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) এখন প্রসেসিং অবস্থায় আছে।` },
    shipped: { title: 'অর্ডার শিপ হয়েছে', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) কুরিয়ারে পাঠানো হয়েছে।${order.extra ? ` ${order.extra}` : ''}` },
    out_for_delivery: { title: 'অর্ডার ডেলিভারির পথে', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) ডেলিভারির পথে আছে — প্রস্তুত থাকুন।` },
    delivered: { title: 'অর্ডার ডেলিভারি হয়েছে', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) ডেলিভারি হয়েছে।${order.extra ? ` ${order.extra}` : ''}` },
    completed: { title: 'অর্ডার সম্পন্ন', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) সম্পন্ন হয়েছে।` },
    cancelled: { title: 'অর্ডার বাতিল', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) বাতিল করা হয়েছে।` },
    refunded: { title: 'অর্ডার রিফান্ড', message: `"${order.productTitle}" অর্ডারটির (${order.orderNumber}) টাকা রিফান্ড করা হয়েছে।` },
    disputed: { title: 'বিরোধ দাখিল হয়েছে', message: `"${order.productTitle}" অর্ডারে (${order.orderNumber}) বিরোধ দাখিল হয়েছে — অ্যাডমিন মীমাংসা করবেন।` },
  }
  const n = map[order.status]
  if (!n) return
  try {
    await notifyUser({
      userId: order.userId,
      type: `order_${order.status}`,
      title: n.title,
      message: n.message,
      relatedType: 'order',
      relatedId: order.id,
    })
  } catch { /* silent */ }
}

/** Seller-facing update (payment submitted / cancelled by buyer / admin actions) */
export async function notifySellerOrderUpdate(order: {
  id: string
  sellerId: string
  orderNumber: string
  productTitle: string
  status: string
  /** Phase 5: appended detail line */
  extra?: string
}): Promise<void> {
  const map: Record<string, { title: string; message: string }> = {
    pending_payment: { title: 'পেমেন্ট জমা হয়েছে', message: `"${order.productTitle}" অর্ডারের (${order.orderNumber}) পেমেন্ট তথ্য জমা হয়েছে — অ্যাডমিন যাচাই করছেন।` },
    cancelled: { title: 'অর্ডার বাতিল', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) ক্রেতা বাতিল করেছেন।` },
    queued: { title: 'পেমেন্ট যাচাই হয়েছে', message: `"${order.productTitle}" অর্ডারের (${order.orderNumber}) পেমেন্ট যাচাই হয়েছে — অর্ডারটি পূরণ করুন।` },
    delivered: { title: 'অর্ডার ডেলিভারি হয়েছে', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) ডেলিভারি হিসেবে চিহ্নিত হয়েছে।` },
    completed: { title: 'অর্ডার সম্পন্ন', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) ক্রেতা গ্রহণ করেছেন — সম্পন্ন।${order.extra ? ` ${order.extra}` : ''}` },
    refunded: { title: 'অর্ডার রিফান্ড', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) রিফান্ড করা হয়েছে।` },
    disputed: { title: 'অর্ডারে বিরোধ', message: `"${order.productTitle}" অর্ডারে (${order.orderNumber}) ক্রেতা বিরোধ দাখিল করেছেন — অ্যাডমিন মীমাংসা করবেন।` },
  }
  const n = map[order.status]
  if (!n) return
  try {
    await notifyUser({
      userId: order.sellerId,
      type: `order_${order.status}`,
      title: n.title,
      message: n.message,
      relatedType: 'order',
      relatedId: order.id,
    })
  } catch { /* silent */ }
}

export async function notifyAdminsOrderPaymentSubmitted(order: {
  id: string
  orderNumber: string
  productTitle: string
  totalAmount: number
  buyerName?: string | null
}): Promise<void> {
  try {
    await notifyAdmins({
      type: 'order_payment_submitted',
      title: 'অর্ডার পেমেন্ট যাচাই প্রয়োজন',
      message: `অর্ডার ${order.orderNumber} ("${order.productTitle}", ৳${order.totalAmount.toLocaleString('en')}) — ক্রেতার পেমেন্ট তথ্য যাচাই করুন।`,
      relatedType: 'order',
      relatedId: order.id,
    })
  } catch { /* silent */ }
}

/** On completion of a paid digital-file order, grant the buyer download access
 *  (same entitlement model the free-claim + deal flows use). */
export async function grantDigitalEntitlementOnComplete(productId: string, buyerId: string): Promise<void> {
  try {
    const product = await db.digitalProduct.findUnique({
      where: { id: productId },
      select: { fileKey: true },
    })
    if (!product?.fileKey) return // physical / service product — nothing to deliver
    await db.productDownload.upsert({
      where: { productId_userId: { productId, userId: buyerId } },
      create: { productId, userId: buyerId, dealId: null },
      update: {},
    })
  } catch { /* entitlement must never fail the completion itself */ }
}

/* ── Physical stock restore (Task 82) ────────────────────────────
   Physical orders RESERVE stock at creation (atomic decrement in
   POST /api/orders). When such an order is CANCELLED, the reserved
   units go back to the product's stock. Refund / failed terminal
   states are offline money-and-ops decisions — the seller adjusts
   stock manually there (the item may have already shipped). */
export async function restorePhysicalStockOnCancel(
  productId: string | null | undefined,
  qty: number,
): Promise<void> {
  if (!productId || !(qty > 0)) return
  try {
    const product = await db.digitalProduct.findUnique({
      where: { id: productId },
      select: { itemType: true },
    })
    if (product?.itemType !== 'physical') return // non-physical has no stock
    await db.digitalProduct.update({
      where: { id: productId },
      data: { quantity: { increment: qty } },
    })
  } catch {
    // best-effort — a stock restore must never fail the cancellation
  }
}
