import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { notifyUser } from '@/lib/push'
import {
  canRefundTransition,
  clipText,
  logAdminAction,
  sanitizeEvidence,
} from '@/lib/order-protection'

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/admin/refunds/[id] — admin review workflow.

   Actions:
   - under_review    requested → under_review
   - request_info    note → buyer-visible infoRequest (stays under_review)
   - approve         requested|under_review → approved
   - reject          any pre-refunded → rejected (note REQUIRED)
   - start_processing approved → processing (refundMethod)
   - mark_refunded   approved|processing → refunded
                     REQUIRES the actual manual refund reference —
                     the row is never marked refunded automatically.

   mark_refunded also moves the ORDER to 'refunded' (existing
   terminal status, legal from every pre-refunded state), stamps
   refundedAt, writes an order event, and notifies buyer + seller.
   Every decision lands in AdminAuditLog.
   ═══════════════════════════════════════════════════════════════ */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({})) as {
      action?: string
      note?: string
      refundMethod?: string
      refundReference?: string
      refundProof?: unknown
    }
    const action = body.action

    const request = await db.refundRequest.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true, orderNumber: true, serviceName: true, status: true,
            paymentStatus: true, totalAmount: true, userId: true, sellerId: true,
            product: { select: { title: true } },
          },
        },
      },
    })

    if (!request) {
      return NextResponse.json({ success: false, error: 'রিফান্ডের আবেদন পাওয়া যায়নি' }, { status: 404 })
    }
    if (request.status === 'refunded') {
      return NextResponse.json({ success: false, error: 'এই রিফান্ড ইতিমধ্যে সম্পন্ন হয়েছে' }, { status: 409 })
    }

    const admin = guard.admin
    const productTitle = request.order.product?.title ?? request.order.serviceName
    const amountLabel = `৳${request.amount.toLocaleString('en')}`

    const buyerNotify = (title: string, message: string, type = 'order_refund_update') =>
      notifyUser({
        userId: request.order.userId, type, title, message,
        relatedType: 'order', relatedId: request.order.id,
      }).catch(() => {})
    const sellerNotify = (title: string, message: string) => {
      if (!request.order.sellerId) return
      notifyUser({
        userId: request.order.sellerId, type: 'order_refund_update', title, message,
        relatedType: 'order', relatedId: request.order.id,
      }).catch(() => {})
    }

    // ── under_review ────────────────────────────────────────────
    if (action === 'under_review') {
      if (!canRefundTransition(request.status, 'under_review')) {
        return NextResponse.json({ success: false, error: 'এই পরিবর্তন সম্ভব নয়' }, { status: 409 })
      }
      const updated = await db.refundRequest.update({
        where: { id: request.id },
        data: { status: 'under_review', reviewedById: admin.userId, reviewedAt: new Date() },
      })
      await buyerNotify('রিফান্ড আবেদন যাচাই চলছে', `"${productTitle}" অর্ডারের (${request.order.orderNumber}) রিফান্ড আবেদন যাচাইয়ের অন্তর্ভুক্ত হয়েছে।`)
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'refund_under_review',
        targetType: 'refund_request', targetId: request.id, orderId: request.orderId,
        details: { from: request.status },
      })
      return NextResponse.json({ success: true, request: updated })
    }

    // ── request_info ────────────────────────────────────────────
    if (action === 'request_info') {
      const note = clipText(body.note, 500)
      if (!note) {
        return NextResponse.json({ success: false, error: 'যে তথ্য প্রয়োজন তা লিখুন' }, { status: 400 })
      }
      if (!['requested', 'under_review'].includes(request.status)) {
        return NextResponse.json({ success: false, error: 'এই পর্যায়ে অতিরিক্ত তথ্য চাওয়া যাবে না' }, { status: 409 })
      }
      const updated = await db.refundRequest.update({
        where: { id: request.id },
        data: {
          status: 'under_review',
          infoRequest: note,
          reviewedById: admin.userId,
          reviewedAt: new Date(),
        },
      })
      await buyerNotify('রিফান্ড আবেদনে তথ্য প্রয়োজন', `"${productTitle}" অর্ডারের (${request.order.orderNumber}) রিফান্ড আবেদনে অতিরিক্ত তথ্য প্রয়োজন: ${note}`)
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'refund_request_info',
        targetType: 'refund_request', targetId: request.id, orderId: request.orderId,
        details: { note },
      })
      return NextResponse.json({ success: true, request: updated })
    }

    // ── approve ─────────────────────────────────────────────────
    if (action === 'approve') {
      if (!canRefundTransition(request.status, 'approved')) {
        return NextResponse.json({ success: false, error: 'এই পর্যায় থেকে অনুমোদন সম্ভব নয়' }, { status: 409 })
      }
      const updated = await db.refundRequest.update({
        where: { id: request.id },
        data: { status: 'approved', reviewedById: admin.userId, reviewedAt: new Date(), adminNote: clipText(body.note, 500) || request.adminNote },
      })
      await buyerNotify('রিফান্ড অনুমোদিত', `"${productTitle}" অর্ডারের (${request.order.orderNumber}) ${amountLabel} রিফান্ড অনুমোদিত হয়েছে — প্রক্রিয়া চলছে।`)
      await sellerNotify('অর্ডার রিফান্ড অনুমোদিত', `"${productTitle}" অর্ডারের (${request.order.orderNumber}) ${amountLabel} রিফান্ড অনুমোদিত হয়েছে — রিফান্ড সম্পন্ন না হওয়া পর্যন্ত অর্ডারটি পূরণ করবেন না।`)
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'refund_approve',
        targetType: 'refund_request', targetId: request.id, orderId: request.orderId,
        details: { amount: request.amount, note: clipText(body.note, 500) || null },
      })
      return NextResponse.json({ success: true, request: updated })
    }

    // ── reject ──────────────────────────────────────────────────
    if (action === 'reject') {
      const note = clipText(body.note, 500)
      if (!note) {
        return NextResponse.json({ success: false, error: 'প্রত্যাখ্যানের কারণ লিখুন' }, { status: 400 })
      }
      if (!canRefundTransition(request.status, 'rejected')) {
        return NextResponse.json({ success: false, error: 'এই পর্যায় থেকে প্রত্যাখ্যান সম্ভব নয়' }, { status: 409 })
      }
      const updated = await db.refundRequest.update({
        where: { id: request.id },
        data: { status: 'rejected', adminNote: note, reviewedById: admin.userId, reviewedAt: new Date() },
      })
      await buyerNotify('রিফান্ড আবেদন প্রত্যাখ্যাত', `"${productTitle}" অর্ডারের (${request.order.orderNumber}) রিফান্ড আবেদন প্রত্যাখ্যাত হয়েছে। কারণ: ${note}`)
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'refund_reject',
        targetType: 'refund_request', targetId: request.id, orderId: request.orderId,
        details: { note },
      })
      return NextResponse.json({ success: true, request: updated })
    }

    // ── start_processing ────────────────────────────────────────
    if (action === 'start_processing') {
      if (!canRefundTransition(request.status, 'processing')) {
        return NextResponse.json({ success: false, error: 'এই পর্যায় থেকে প্রক্রিয়াকরণ শুরু করা যায় না' }, { status: 409 })
      }
      const updated = await db.refundRequest.update({
        where: { id: request.id },
        data: {
          status: 'processing',
          refundMethod: clipText(body.refundMethod, 80) || null,
          reviewedById: admin.userId,
          reviewedAt: new Date(),
        },
      })
      await buyerNotify('রিফান্ড প্রক্রিয়াধীন', `"${productTitle}" অর্ডারের (${request.order.orderNumber}) ${amountLabel} রিফান্ড পাঠানো হচ্ছে${updated.refundMethod ? ` (${updated.refundMethod})` : ''}।`)
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'refund_processing',
        targetType: 'refund_request', targetId: request.id, orderId: request.orderId,
        details: { refundMethod: updated.refundMethod },
      })
      return NextResponse.json({ success: true, request: updated })
    }

    // ── mark_refunded ───────────────────────────────────────────
    if (action === 'mark_refunded') {
      const reference = clipText(body.refundReference, 120)
      if (!canRefundTransition(request.status, 'refunded')) {
        return NextResponse.json({ success: false, error: 'এই পর্যায় থেকে রিফান্ড সম্পন্ন করা যায় না' }, { status: 409 })
      }
      if (!reference) {
        return NextResponse.json(
          { success: false, error: 'রিফান্ড ট্রানজেকশন রেফারেন্স লিখুন — প্রকৃত রিফান্ড যাচাই ছাড়া সম্পন্ন করা যাবে না' },
          { status: 400 },
        )
      }
      const proof = sanitizeEvidence(body.refundProof, request.orderId)
      const now = new Date()
      const [updated] = await db.$transaction([
        db.refundRequest.update({
          where: { id: request.id },
          data: {
            status: 'refunded',
            refundReference: reference,
            refundProof: proof.length ? JSON.stringify(proof) : request.refundProof,
            refundMethod: clipText(body.refundMethod, 80) || request.refundMethod,
            refundedAt: now,
            reviewedById: admin.userId,
            reviewedAt: request.reviewedAt ?? now,
          },
        }),
        db.marketplaceOrder.update({
          where: { id: request.orderId },
          data: { status: 'refunded', refundedAt: now },
        }),
      ])
      await db.marketplaceOrderEvent.create({
        data: {
          orderId: request.orderId,
          type: 'refunded',
          fromStatus: request.order.status,
          toStatus: 'refunded',
          message: `রিফান্ড সম্পন্ন — ${amountLabel} (রেফারেন্স: ${reference})`,
          actorType: 'admin',
          actorId: admin.userId,
          actorName: admin.user.name,
        },
      }).catch(() => {})
      await buyerNotify('রিফান্ড সম্পন্ন', `"${productTitle}" অর্ডারের (${request.order.orderNumber}) ${amountLabel} রিফান্ড পাঠানো হয়েছে। রেফারেন্স: ${reference}`, 'order_refunded')
      await sellerNotify('অর্ডার রিফান্ড সম্পন্ন', `"${productTitle}" অর্ডারটি (${request.order.orderNumber}) রিফান্ড সম্পন্ন হয়ে বাতিল হয়েছে।`)
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'refund_completed',
        targetType: 'refund_request', targetId: request.id, orderId: request.orderId,
        details: { amount: request.amount, reference, proof: proof.map((p) => p.key) },
      })
      // ── Phase 7: seller ledger — verified refund debits the seller and
      // reverses the commission at the sale's snapshot rate (idempotent) ──
      if (request.order.sellerId) {
        const { recordMarketplaceRefund } = await import('@/lib/seller-ledger')
        await recordMarketplaceRefund({
          orderId: request.orderId,
          sellerId: request.order.sellerId,
          refundAmount: request.amount,
          orderNumber: request.order.orderNumber,
          refundRequestId: request.id,
        })
      }
      return NextResponse.json({ success: true, request: updated })
    }

    return NextResponse.json({ success: false, error: 'অজানা অ্যাকশন' }, { status: 400 })
  } catch (err) {
    console.error('[admin-refund PATCH] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
