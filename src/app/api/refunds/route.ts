import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { notifyAdmins } from '@/lib/push'
import {
  checkRefundEligibility,
  clipText,
  protectionProductType,
  sanitizeEvidence,
  type ProtectionOrderShape,
} from '@/lib/order-protection'
import { toPoisha, fromPoisha } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════════
   POST /api/refunds — buyer files a refund request.

   Eligibility (server-enforced): VERIFIED paid order, status-based
   product-type rules (physical up to completion, digital before
   delivery, service while live). Amount is capped at the verified
   paid total and computed in integer poisha. One request per order.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => ({})) as {
      orderId?: string
      reason?: string
      amount?: number | string
      evidence?: unknown
    }

    const orderId = clipText(body.orderId, 64)
    const reason = clipText(body.reason, 1000)
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'অর্ডার আইডি প্রয়োজন' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ success: false, error: 'রিফান্ডের কারণ লিখুন' }, { status: 400 })
    }

    const order = await db.marketplaceOrder.findUnique({
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
        product: { select: { itemType: true, title: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 })
    }
    if (order.userId !== guard.userId) {
      return NextResponse.json({ success: false, error: 'শুধু ক্রেতা রিফান্ডের আবেদন করতে পারবেন' }, { status: 403 })
    }

    const type = protectionProductType(order, order.product?.itemType)
    const eligibility = checkRefundEligibility(order as ProtectionOrderShape, type)
    if (!eligibility.ok) {
      return NextResponse.json({ success: false, error: eligibility.error, code: eligibility.code }, { status: 409 })
    }

    // Amount: integer-poisha math, capped at the verified paid total.
    const requested = typeof body.amount === 'string' ? Number(body.amount) : body.amount
    const amountPoisha = Math.round((Number(requested) || 0) * 100)
    const maxPoisha = toPoisha(order.totalAmount)
    if (!Number.isFinite(amountPoisha) || amountPoisha <= 0) {
      return NextResponse.json({ success: false, error: 'সঠিক রিফান্ডের পরিমাণ লিখুন' }, { status: 400 })
    }
    if (amountPoisha > maxPoisha) {
      return NextResponse.json(
        { success: false, error: `রিফান্ডের পরিমাণ পরিশোধিত মূল্য (৳${fromPoisha(maxPoisha).toLocaleString('en')}) অপেক্ষা বেশি হতে পারে না` },
        { status: 400 },
      )
    }
    const amount = fromPoisha(amountPoisha)

    const evidence = sanitizeEvidence(body.evidence, order.id)

    const request = await db.refundRequest.create({
      data: {
        orderId: order.id,
        requestedById: guard.userId,
        reason,
        evidence: evidence.length ? JSON.stringify(evidence) : null,
        amount,
        status: 'requested',
      },
    }).catch((err: { code?: string }) => {
      if (err?.code === 'P2002') return null
      throw err
    })

    if (!request) {
      return NextResponse.json(
        { success: false, error: 'এই অর্ডারের জন্য ইতিমধ্যে একটি রিফান্ডের আবেদন আছে' },
        { status: 409 },
      )
    }

    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'refund_requested',
        message: `রিফান্ডের আবেদন — ৳${amount.toLocaleString('en')}: ${reason}`,
        actorType: 'buyer',
        actorId: guard.userId,
      },
    }).catch(() => {})

    const productTitle = order.product?.title ?? order.serviceName
    notifyAdmins({
      type: 'order_refund_submitted',
      title: 'নতুন রিফান্ডের আবেদন',
      message: `অর্ডার ${order.orderNumber} ("${productTitle}") — ক্রেতা ৳${amount.toLocaleString('en')} রিফান্ড চায়। যাচাই করুন।`,
      relatedType: 'order',
      relatedId: order.id,
    }).catch(() => {})

    return NextResponse.json({ success: true, request })
  } catch (err) {
    console.error('[refunds POST] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
