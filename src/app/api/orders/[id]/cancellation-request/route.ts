import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'
import { notifyUser, notifyAdmins } from '@/lib/push'
import {
  checkCancellationEligibility,
  clipText,
  logAdminAction,
  protectionProductType,
  type ProtectionOrderShape,
} from '@/lib/order-protection'

/* ═══════════════════════════════════════════════════════════════
   /api/orders/[id]/cancellation-request

   POST   buyer files a cancellation request (one per order).
   PATCH  seller/admin decides: approve | reject.

   Money safety:
   - Unpaid orders never need this flow (direct self-cancel exists).
   - awaiting_verification: ONLY an admin may approve — approving
     voids the payment evidence (paymentStatus → failed). A seller
     decision here would risk bypassing payment verification.
   - paid + unfulfilled: approval NEVER cancels the order — it
     spawns a RefundRequest; the order is only cancelled/refunded
     after the admin records a verified manual refund.
   ═══════════════════════════════════════════════════════════════ */

async function loadOrderWithContext(orderId: string) {
  return db.marketplaceOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      serviceName: true,
      status: true,
      paymentStatus: true,
      userId: true,
      sellerId: true,
      productId: true,
      serviceId: true,
      totalAmount: true,
      refundedAt: true,
      quantity: true,
      product: { select: { itemType: true, title: true } },
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({})) as { reason?: string }
    const reason = clipText(body.reason, 500)
    if (!reason) {
      return NextResponse.json({ success: false, error: 'বাতিল করার কারণ লিখুন' }, { status: 400 })
    }

    const order = await loadOrderWithContext(id)
    if (!order) {
      return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 })
    }
    if (order.userId !== guard.userId) {
      return NextResponse.json({ success: false, error: 'শুধু ক্রেতা বাতিলের আবেদন করতে পারবেন' }, { status: 403 })
    }

    const type = protectionProductType(order, order.product?.itemType)
    const eligibility = checkCancellationEligibility(order as ProtectionOrderShape, type)
    if (!eligibility.ok) {
      return NextResponse.json({ success: false, error: eligibility.error, code: eligibility.code }, { status: 409 })
    }

    // One request per order — duplicates blocked at DB level as well.
    const request = await db.orderCancellationRequest.create({
      data: {
        orderId: order.id,
        requestedById: guard.userId,
        requestedByRole: 'buyer',
        reason,
        status: 'pending',
      },
    }).catch((err: { code?: string }) => {
      if (err?.code === 'P2002') return null
      throw err
    })

    if (!request) {
      return NextResponse.json(
        { success: false, error: 'এই অর্ডারের জন্য ইতিমধ্যে একটি বাতিলের আবেদন আছে' },
        { status: 409 },
      )
    }

    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'cancellation_requested',
        message: reason,
        actorType: 'buyer',
        actorId: guard.userId,
      },
    }).catch(() => {})

    const productTitle = order.product?.title ?? order.serviceName
    // Notify the seller (product orders) and admins for platform orders.
    if (order.sellerId) {
      notifyUser({
        userId: order.sellerId,
        type: 'order_cancellation_requested',
        title: 'অর্ডার বাতিলের আবেদন',
        message: `"${productTitle}" অর্ডারের (${order.orderNumber}) জন্য ক্রেতা বাতিলের আবেদন করেছেন — সিদ্ধান্ত নিন।`,
        relatedType: 'order',
        relatedId: order.id,
      }).catch(() => {})
    } else {
      notifyAdmins({
        type: 'order_cancellation_requested',
        title: 'অর্ডার বাতিলের আবেদন',
        message: `প্ল্যাটফর্ম অর্ডার ${order.orderNumber} ("${productTitle}") — ক্রেতা বাতিলের আবেদন করেছেন।`,
        relatedType: 'order',
        relatedId: order.id,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, request })
  } catch (err) {
    console.error('[cancellation-request POST] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({})) as { action?: string; note?: string }
    const action = body.action
    const note = clipText(body.note, 500)

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: 'অবৈধ অ্যাকশন' }, { status: 400 })
    }
    if (action === 'reject' && !note) {
      return NextResponse.json({ success: false, error: 'প্রত্যাখ্যানের কারণ লিখুন' }, { status: 400 })
    }

    const order = await loadOrderWithContext(id)
    if (!order) {
      return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 })
    }

    const request = await db.orderCancellationRequest.findUnique({ where: { orderId: order.id } })
    if (!request) {
      return NextResponse.json({ success: false, error: 'কোনো বাতিলের আবেদন নেই' }, { status: 404 })
    }
    if (request.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'এই আবেদনের সিদ্ধান্ত ইতিমধ্যে হয়ে গেছে' }, { status: 409 })
    }

    // ── Role resolution (server-side, never client-claimed) ──
    const admin = await getAdminFromRequest(req)
    const isSeller = !!order.sellerId && order.sellerId === guard.userId
    if (!admin && !isSeller) {
      return NextResponse.json({ success: false, error: 'শুধু বিক্রেতা বা অ্যাডমিন সিদ্ধান্ত নিতে পারবেন' }, { status: 403 })
    }
    const deciderRole: 'seller' | 'admin' = admin ? 'admin' : 'seller'
    const deciderId = admin ? admin.userId : guard.userId
    const deciderName = admin?.user.name ?? null

    const productTitle = order.product?.title ?? order.serviceName

    // ── REJECT ──────────────────────────────────────────────────
    if (action === 'reject') {
      const updated = await db.orderCancellationRequest.update({
        where: { id: request.id },
        data: {
          status: 'rejected',
          decidedById: deciderId,
          decidedByRole: deciderRole,
          decisionNote: note,
          decidedAt: new Date(),
        },
      })
      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'cancellation_rejected',
          message: note,
          actorType: deciderRole,
          actorId: deciderId,
          actorName: deciderName,
        },
      }).catch(() => {})
      notifyUser({
        userId: order.userId,
        type: 'order_cancellation_rejected',
        title: 'বাতিলের আবেদন প্রত্যাখ্যাত',
        message: `"${productTitle}" অর্ডারের (${order.orderNumber}) বাতিলের আবেদন প্রত্যাখ্যাত হয়েছে। কারণ: ${note}`,
        relatedType: 'order',
        relatedId: order.id,
      }).catch(() => {})
      if (admin) {
        await logAdminAction({
          adminId: admin.userId, adminName: admin.user.name, action: 'cancellation_reject',
          targetType: 'cancellation_request', targetId: request.id, orderId: order.id,
          details: { note },
        })
      }
      return NextResponse.json({ success: true, request: updated })
    }

    // ── APPROVE ─────────────────────────────────────────────────
    // awaiting_verification: money question still open → admin-only.
    if (order.paymentStatus === 'awaiting_verification') {
      if (!admin) {
        return NextResponse.json(
          {
            success: false,
            code: 'ADMIN_DECISION_REQUIRED',
            error: 'পেমেন্ট যাচাইয়ের অপেক্ষায় থাকা অর্ডারের বাতিল শুধু অ্যাডমিন অনুমোদন করতে পারবেন',
          },
          { status: 409 },
        )
      }
      const [updatedRequest] = await db.$transaction([
        db.orderCancellationRequest.update({
          where: { id: request.id },
          data: {
            status: 'approved',
            decidedById: deciderId,
            decidedByRole: 'admin',
            decisionNote: note || null,
            decidedAt: new Date(),
          },
        }),
        db.marketplaceOrder.update({
          where: { id: order.id },
          data: {
            status: 'cancelled',
            paymentStatus: 'failed',
            cancelledAt: new Date(),
            cancelledBy: 'admin',
            cancelReason: clipText(`cancellation_request: ${request.reason}`, 500),
          },
        }),
      ])
      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'cancelled',
          fromStatus: order.status,
          toStatus: 'cancelled',
          message: `অ্যাডমিন বাতিলের আবেদন অনুমোদন করেছেন — অযাচাইকৃত পেমেন্ট বাতিল। ${note ?? ''}`.trim(),
          actorType: 'admin',
          actorId: deciderId,
          actorName: deciderName,
        },
      }).catch(() => {})
      notifyUser({
        userId: order.userId,
        type: 'order_cancellation_approved',
        title: 'অর্ডার বাতিল হয়েছে',
        message: `"${productTitle}" অর্ডারটি (${order.orderNumber}) আপনার বাতিলের আবেদনের ভিত্তিতে বাতিল করা হয়েছে।`,
        relatedType: 'order',
        relatedId: order.id,
      }).catch(() => {})
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'cancellation_approve_unverified',
        targetType: 'cancellation_request', targetId: request.id, orderId: order.id,
        details: { note, paymentStatus: 'failed' },
      })
      return NextResponse.json({ success: true, request: updatedRequest })
    }

    // Paid orders: approval spawns a RefundRequest — the order itself is
    // never cancelled before the refund is verified by an admin.
    const refund = await db.refundRequest.create({
      data: {
        orderId: order.id,
        requestedById: order.userId,
        reason: `বাতিলের আবেদন অনুমোদিত — ${request.reason}`,
        amount: order.totalAmount,
        status: 'requested',
        cancellationRequestId: request.id,
      },
    })
    const updatedRequest = await db.orderCancellationRequest.update({
      where: { id: request.id },
      data: {
        status: 'approved',
        decidedById: deciderId,
        decidedByRole: deciderRole,
        decisionNote: note || null,
        decidedAt: new Date(),
        refundRequestId: refund.id,
      },
    })

    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'cancellation_approved',
        message: `বাতিলের আবেদন অনুমোদিত — রিফান্ড প্রক্রিয়াধীন (৳${order.totalAmount.toLocaleString('en')})। রিফান্ড যাচাইয়ের পর অর্ডার বাতিল হবে।`,
        actorType: deciderRole,
        actorId: deciderId,
        actorName: deciderName,
      },
    }).catch(() => {})

    notifyUser({
      userId: order.userId,
      type: 'order_cancellation_approved',
      title: 'বাতিলের আবেদন অনুমোদিত',
      message: `"${productTitle}" অর্ডারের (${order.orderNumber}) বাতিলের আবেদন অনুমোদিত হয়েছে — রিফান্ড (৳${order.totalAmount.toLocaleString('en')}) প্রক্রিয়াধীন।`,
      relatedType: 'order',
      relatedId: order.id,
    }).catch(() => {})
    notifyAdmins({
      type: 'order_refund_submitted',
      title: 'রিফান্ড প্রয়োজন (বাতিল অনুমোদিত)',
      message: `অর্ডার ${order.orderNumber} ("${productTitle}", ৳${order.totalAmount.toLocaleString('en')}) — বাতিল অনুমোদনের ফলে রিফান্ড প্রক্রিয়া করুন।`,
      relatedType: 'order',
      relatedId: order.id,
    }).catch(() => {})
    if (order.sellerId) {
      notifyUser({
        userId: order.sellerId,
        type: 'order_cancellation_approved',
        title: 'অর্ডার বাতিলের আবেদন অনুমোদিত',
        message: `"${productTitle}" অর্ডারের (${order.orderNumber}) বাতিলের আবেদন অনুমোদিত হয়েছে — রিফান্ড সম্পন্ন না হওয়া পর্যন্ত অর্ডারটি পূরণ করবেন না।`,
        relatedType: 'order',
        relatedId: order.id,
      }).catch(() => {})
    }
    if (admin) {
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'cancellation_approve_refund',
        targetType: 'cancellation_request', targetId: request.id, orderId: order.id,
        details: { note, refundRequestId: refund.id, amount: order.totalAmount },
      })
    }

    return NextResponse.json({ success: true, request: updatedRequest, refundRequestId: refund.id })
  } catch (err) {
    console.error('[cancellation-request PATCH] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
