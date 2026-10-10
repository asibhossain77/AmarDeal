import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { piprapayVerifyPayment } from '@/lib/piprapay'
import { confirmMarketplaceOrderPayment } from '@/lib/marketplace-payments'

/* ═══════════════════════════════════════════════════════════
   POST /api/marketplace/payment/webhook
   Public PipraPay webhook (marketplace orders only — the deal
   webhook at /api/payment/piprapay/webhook is untouched).

   The webhook payload is UNTRUSTED: it is treated as a trigger
   only. The server re-verifies the payment server-to-server
   before confirming the order. Duplicate callbacks are
   idempotent no-ops.
   ═══════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const ppId = body && typeof body === 'object' ? String((body as Record<string, unknown>).pp_id || '').trim() : ''
    const metaOrderId = body && typeof body === 'object' && (body as Record<string, unknown>).metadata && typeof (body as Record<string, unknown>).metadata === 'object'
      ? String(((body as Record<string, unknown>).metadata as Record<string, unknown>).order_id || '')
      : ''

    if (!ppId) {
      return NextResponse.json({ success: false, error: 'pp_id is required' }, { status: 400 })
    }

    // Order resolution: metadata.order_id first, then invoice id — both re-verified below
    let orderId: string | undefined = metaOrderId || undefined
    if (!orderId) {
      orderId = (
        await db.marketplaceOrder.findFirst({
          where: { piprapayInvoiceId: ppId },
          select: { id: true },
        })
      )?.id
    }

    // Trusted server-to-server verification
    const verify = await piprapayVerifyPayment(ppId)
    if (!verify.ok) {
      return NextResponse.json({ success: false, error: 'verification_failed' }, { status: 400 })
    }

    if (!orderId) {
      const verifiedMeta = verify.metadata && typeof verify.metadata === 'object'
        ? String((verify.metadata as Record<string, unknown>).order_id || '')
        : ''
      orderId = verifiedMeta || undefined
    }

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'order_not_found' }, { status: 404 })
    }

    // Belt-and-braces: the verified payment must reference the same order
    const verifiedMeta = verify.metadata && typeof verify.metadata === 'object'
      ? String((verify.metadata as Record<string, unknown>).order_id || '')
      : ''
    if (verifiedMeta && verifiedMeta !== orderId) {
      return NextResponse.json({ success: false, error: 'order_mismatch' }, { status: 400 })
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
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, alreadyPaid: result.alreadyPaid })
  } catch (err) {
    console.error('[mp-webhook] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
