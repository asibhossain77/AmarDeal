import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { notifyAdmins } from '@/lib/push'

/* ═══════════════════════════════════════════════════════════
   POST /api/marketplace/orders/[id]/payment
   Manual payment submission (bKash/Nagad etc. to the platform's
   own accounts — same PaymentMethod table the deal flow uses).

   - Owner-only.
   - Only for unpaid pending_payment orders.
   - Duplicate transaction IDs are rejected across BOTH marketplace
     orders and deals (the same money cannot pay twice).
   - The order is NOT marked paid — it goes to
     paymentStatus=awaiting_verification until an admin verifies.
   ═══════════════════════════════════════════════════════════ */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const paymentMethodId = String((body as Record<string, unknown>).paymentMethodId || '').trim()
    const senderNumber = String((body as Record<string, unknown>).senderNumber || '').trim().slice(0, 32)
    const transactionId = String((body as Record<string, unknown>).transactionId || '').trim().slice(0, 64)

    if (!paymentMethodId || !senderNumber || !transactionId) {
      return NextResponse.json(
        { success: false, error: 'পেমেন্ট মেথড, সেন্ডার নম্বর ও ট্রানজেকশন আইডি দিন' },
        { status: 400 },
      )
    }

    const order = await db.marketplaceOrder.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== guard.userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }
    if (order.status !== 'pending_payment' || order.paymentStatus !== 'unpaid') {
      return NextResponse.json(
        { success: false, error: 'এই অর্ডারে পেমেন্ট গ্রহণযোগ্য নয়' },
        { status: 409 },
      )
    }

    // Duplicate TXN protection — across marketplace orders AND deals
    const [dupOrder, dupDeal] = await Promise.all([
      db.marketplaceOrder.findFirst({
        where: { transactionId, id: { not: order.id } },
        select: { orderNumber: true },
      }),
      db.deal.findFirst({ where: { transactionId }, select: { id: true } }),
    ])
    if (dupOrder || dupDeal) {
      return NextResponse.json(
        { success: false, error: 'এই ট্রানজেকশন আইডি আগেই ব্যবহার করা হয়েছে' },
        { status: 409 },
      )
    }

    const method = await db.paymentMethod.findUnique({ where: { id: paymentMethodId } })
    if (!method || method.status !== 'active') {
      return NextResponse.json({ success: false, error: 'পেমেন্ট মেথড পাওয়া যায়নি' }, { status: 400 })
    }

    const updated = await db.marketplaceOrder.updateMany({
      where: { id: order.id, status: 'pending_payment', paymentStatus: 'unpaid' },
      data: {
        paymentStatus: 'awaiting_verification',
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        senderNumber,
        transactionId,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: 'এই অর্ডারে পেমেন্ট গ্রহণযোগ্য নয়' }, { status: 409 })
    }

    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'payment_submitted',
        message: `Manual payment submitted via ${method.name} — TXN ${transactionId}. Awaiting admin verification.`,
        actorType: 'user',
        actorId: guard.userId,
      },
    })

    notifyAdmins({
      type: 'marketplace_order_payment',
      title: 'মার্কেটপ্লেস অর্ডার পেমেন্ট',
      message: `${order.orderNumber} — ${method.name} TXN ${transactionId} (৳${order.totalAmount.toFixed(2)}) যাচাই করুন`,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[marketplace-order-payment] POST error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
