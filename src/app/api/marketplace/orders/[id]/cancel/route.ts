import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { CUSTOMER_CANCELLABLE } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════
   POST /api/marketplace/orders/[id]/cancel
   Owner-only cancellation of an UNPAID order (pending_payment).
   Paid orders can never be cancelled by the customer — refunds
   are an admin action. Atomic guarded update.
   ═══════════════════════════════════════════════════════════ */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, paymentStatus: true, orderNumber: true, serviceName: true },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== guard.userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }
    if (!CUSTOMER_CANCELLABLE.has(order.status)) {
      return NextResponse.json(
        { success: false, error: 'পেমেন্ট হয়ে যাওয়া অর্ডার বাতিল করা যাবে না — সাপোর্টে যোগাযোগ করুন' },
        { status: 409 },
      )
    }

    const updated = await db.marketplaceOrder.updateMany({
      where: { id: order.id, status: 'pending_payment', paymentStatus: 'unpaid' },
      data: { status: 'cancelled', cancelReason: 'customer_cancelled' },
    })

    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: 'অর্ডারটি এখন বাতিলযোগ্য নয়' }, { status: 409 })
    }

    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'cancelled',
        fromStatus: 'pending_payment',
        toStatus: 'cancelled',
        message: 'Order cancelled by customer (unpaid)',
        actorType: 'user',
        actorId: guard.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[marketplace-order-cancel] POST error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
