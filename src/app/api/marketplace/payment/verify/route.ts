import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { piprapayVerifyPayment } from '@/lib/piprapay'
import { confirmMarketplaceOrderPayment } from '@/lib/marketplace-payments'

/* ═══════════════════════════════════════════════════════════
   POST /api/marketplace/payment/verify
   Body: { pp_id }

   Customer-return trigger. The pp_id itself is UNTRUSTED — the
   server re-verifies it against PipraPay's verify-payments API
   (server-to-server, API key auth) before touching the order.
   Idempotent: repeated calls are safe no-ops once paid.
   ═══════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    const ppId = body && typeof body === 'object' ? String((body as Record<string, unknown>).pp_id || '').trim() : ''
    if (!ppId) {
      return NextResponse.json({ success: false, error: 'pp_id is required' }, { status: 400 })
    }

    // Locate the order: by stored invoice id, else via gateway metadata
    let orderId = (
      await db.marketplaceOrder.findFirst({
        where: { piprapayInvoiceId: ppId },
        select: { id: true },
      })
    )?.id

    const verify = await piprapayVerifyPayment(ppId)
    if (!verify.ok) {
      return NextResponse.json({ success: false, error: 'পেমেন্ট ভেরিফাই করা যায়নি' }, { status: 400 })
    }

    if (!orderId) {
      const metaOrderId = verify.metadata && typeof verify.metadata === 'object'
        ? String((verify.metadata as Record<string, unknown>).order_id || '')
        : ''
      if (metaOrderId) {
        orderId = (
          await db.marketplaceOrder.findUnique({ where: { id: metaOrderId }, select: { id: true } })
        )?.id
      }
    }

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order not found for this payment' }, { status: 404 })
    }

    // Ownership check — only the order owner (or an admin) may trigger verify
    const order = await db.marketplaceOrder.findUnique({
      where: { id: orderId },
      select: { userId: true },
    })
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== guard.userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const result = await confirmMarketplaceOrderPayment({
      orderId,
      amount: verify.amount ?? NaN,
      currency: verify.currency,
      gatewayStatus: verify.status,
      paymentMethodName: verify.paymentMethod,
      senderNumber: verify.senderNumber,
      transactionId: verify.transactionId,
      verifiedBy: 'piprapay',
    })

    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : result.error === 'not_pending' ? 409 : 400
      return NextResponse.json({ success: false, error: result.error, detail: result.detail }, { status })
    }

    return NextResponse.json({ success: true, alreadyPaid: result.alreadyPaid, orderId })
  } catch (err) {
    console.error('[mp-verify] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
