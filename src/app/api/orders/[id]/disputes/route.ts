import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'
import { notifyUser, notifyAdmins } from '@/lib/push'
import {
  checkDisputeEligibility,
  clipText,
  isDisputeCategory,
  protectionProductType,
  sanitizeEvidence,
  type ProtectionOrderShape,
} from '@/lib/order-protection'

/* ═══════════════════════════════════════════════════════════════
   /api/orders/[id]/disputes

   POST  buyer OR seller raises a categorized dispute with optional
         evidence. One dispute per order. On non-completed orders the
         order flips to the existing 'disputed' status (preDisputeStatus
         is kept so a rejected dispute can resume fulfilment); on
         completed orders the dispute record stands alone.
   GET   parties (buyer/seller/admin) read the dispute + full thread.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({})) as {
      category?: string
      description?: string
      evidence?: unknown
    }

    const category = isDisputeCategory(body.category) ? body.category : 'other'
    const description = clipText(body.description, 2000)
    if (!description) {
      return NextResponse.json({ success: false, error: 'বিরোধের বিবরণ লিখুন' }, { status: 400 })
    }

    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      select: {
        id: true, orderNumber: true, serviceName: true,
        status: true, paymentStatus: true,
        userId: true, sellerId: true, productId: true, serviceId: true,
        totalAmount: true, refundedAt: true,
        product: { select: { itemType: true, title: true } },
      },
    })
    if (!order) {
      return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 })
    }

    // Role: buyer or seller of THIS order — server-side, never claimed.
    const isBuyer = order.userId === guard.userId
    const isSeller = !!order.sellerId && order.sellerId === guard.userId
    if (!isBuyer && !isSeller) {
      return NextResponse.json({ success: false, error: 'শুধু ক্রেতা বা বিক্রেতা বিরোধ দাখিল করতে পারবেন' }, { status: 403 })
    }
    const raisedByRole: 'buyer' | 'seller' = isBuyer ? 'buyer' : 'seller'

    const type = protectionProductType(order, order.product?.itemType)
    const eligibility = checkDisputeEligibility(order as ProtectionOrderShape)
    if (!eligibility.ok) {
      return NextResponse.json({ success: false, error: eligibility.error, code: eligibility.code }, { status: 409 })
    }

    const evidence = sanitizeEvidence(body.evidence, order.id)
    const orderCompleted = order.status === 'completed'

    const dispute = await db.orderDispute.create({
      data: {
        orderId: order.id,
        raisedById: guard.userId,
        raisedByRole,
        preDisputeStatus: orderCompleted ? null : order.status,
        category,
        description,
        evidence: evidence.length ? JSON.stringify(evidence) : null,
        status: 'open',
      },
    }).catch((err: { code?: string }) => {
      if (err?.code === 'P2002') return null
      throw err
    })

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: 'এই অর্ডারে ইতিমধ্যে একটি বিরোধ রয়েছে' },
        { status: 409 },
      )
    }

    // Flip the order to 'disputed' (existing vocabulary) unless it already
    // reached completion — there the dispute record tracks the conflict.
    if (!orderCompleted) {
      await db.marketplaceOrder.update({
        where: { id: order.id },
        data: {
          status: 'disputed',
          disputeReason: clipText(`[${category}] ${description}`, 500),
          disputedAt: new Date(),
        },
      }).catch(() => {})
    }

    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'disputed',
        fromStatus: order.status,
        toStatus: orderCompleted ? order.status : 'disputed',
        message: `[${category}] ${description}`,
        actorType: raisedByRole,
        actorId: guard.userId,
      },
    }).catch(() => {})

    const productTitle = order.product?.title ?? order.serviceName
    const categoryLabel = category.replace(/_/g, ' ')
    if (raisedByRole === 'buyer') {
      if (order.sellerId) {
        notifyUser({
          userId: order.sellerId,
          type: 'order_dispute_opened',
          title: 'অর্ডারে বিরোধ দাখিল হয়েছে',
          message: `"${productTitle}" অর্ডারের (${order.orderNumber}) বিরোধ দাখিল হয়েছে (${categoryLabel}) — অ্যাডমিন মীমাংসা করবেন।`,
          relatedType: 'order',
          relatedId: order.id,
        }).catch(() => {})
      }
    } else {
      notifyUser({
        userId: order.userId,
        type: 'order_dispute_opened',
        title: 'আপনার অর্ডারে বিরোধ দাখিল হয়েছে',
        message: `"${productTitle}" অর্ডারের (${order.orderNumber}) বিরোধ দাখিল হয়েছে (${categoryLabel}) — অর্ডার পেজে বিস্তারিত দেখুন।`,
        relatedType: 'order',
        relatedId: order.id,
      }).catch(() => {})
    }
    notifyAdmins({
      type: 'order_dispute_opened',
      title: 'নতুন অর্ডার বিরোধ',
      message: `অর্ডার ${order.orderNumber} ("${productTitle}", ৳${order.totalAmount.toLocaleString('en')}) — ${raisedByRole === 'buyer' ? 'ক্রেতা' : 'বিক্রেতা'} বিরোধ দাখিল করেছেন (${categoryLabel})।`,
      relatedType: 'order',
      relatedId: order.id,
    }).catch(() => {})

    return NextResponse.json({ success: true, dispute })
  } catch (err) {
    console.error('[disputes POST] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

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
      select: { id: true, userId: true, sellerId: true },
    })
    if (!order) {
      return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 })
    }

    const isAdmin = !!(await getAdminFromRequest(req))
    const isBuyer = order.userId === guard.userId
    const isSeller = !!order.sellerId && order.sellerId === guard.userId
    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ success: false, error: 'অনুমতি নেই' }, { status: 403 })
    }

    const dispute = await db.orderDispute.findUnique({
      where: { orderId: order.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    return NextResponse.json({ success: true, dispute })
  } catch (err) {
    console.error('[disputes GET] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
