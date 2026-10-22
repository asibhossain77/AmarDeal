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
export const FULFILMENT_STATUSES: readonly string[] = ['queued', 'processing', 'in_progress']

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

export interface OrderShape {
  id: string
  status: string
  paymentStatus: string
  userId: string
  sellerId: string | null
  productId: string | null
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
}

export function isOrderStatus(v: unknown): v is string {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)
}

/**
 * Validate a requested product-order transition against the actor's
 * role. Roles: 'buyer' (the order's user), 'seller' (the order's
 * sellerId), 'admin' (verified Admin record — checked by the caller).
 */
export function checkOrderTransition(
  order: OrderShape,
  action: OrderAction,
  role: 'buyer' | 'seller' | 'admin',
  reason?: string,
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

  // ── Phase 3: dispute flow ──
  // Buyer (or admin) may open a dispute on a PAID, in-fulfilment order.
  // Only an admin can resolve it — sellers cannot resolve or reject
  // disputes on their own, and nobody can dispute an unpaid order
  // (unpaid orders are simply cancelled).
  if (action === 'dispute') {
    if (role === 'seller') {
      return { ok: false, code: 'FORBIDDEN', error: 'বিক্রেতা নিজের অর্ডারে বিরোধ দাখিল করতে পারবেন না' }
    }
    if (!['queued', 'processing', 'in_progress'].includes(order.status)) {
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
}): Promise<void> {
  const map: Record<string, { title: string; message: string }> = {
    queued: { title: 'পেমেন্ট যাচাই সম্পন্ন', message: `"${order.productTitle}" অর্ডারের (${order.orderNumber}) পেমেন্ট যাচাই হয়েছে — বিক্রেতা কাজ শুরু করবেন।` },
    processing: { title: 'অর্ডার প্রসেসিং', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) এখন প্রসেসিং অবস্থায় আছে।` },
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
}): Promise<void> {
  const map: Record<string, { title: string; message: string }> = {
    pending_payment: { title: 'পেমেন্ট জমা হয়েছে', message: `"${order.productTitle}" অর্ডারের (${order.orderNumber}) পেমেন্ট তথ্য জমা হয়েছে — অ্যাডমিন যাচাই করছেন।` },
    cancelled: { title: 'অর্ডার বাতিল', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) ক্রেতা বাতিল করেছেন।` },
    queued: { title: 'পেমেন্ট যাচাই হয়েছে', message: `"${order.productTitle}" অর্ডারের (${order.orderNumber}) পেমেন্ট যাচাই হয়েছে — অর্ডারটি পূরণ করুন।` },
    completed: { title: 'অর্ডার সম্পন্ন', message: `"${order.productTitle}" অর্ডারটি (${order.orderNumber}) সম্পন্ন হিসেবে চিহ্নিত হয়েছে।` },
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
