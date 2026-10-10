import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { piprapayCreateCharge, piprapayAppUrl } from '@/lib/piprapay'

/* ═══════════════════════════════════════════════════════════
   POST /api/marketplace/payment/create-charge
   Body: { orderId }

   Creates a PipraPay charge for an UNPAID pending order.
   - Owner-only.
   - The invoice id is stored BEFORE the customer is redirected
     (no crash window where money can arrive un-correlated).
   - metadata.order_id lets webhook/verify find the order even
     if the invoice row was replaced by a retry.
   ═══════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    const orderId = body && typeof body === 'object' ? String((body as Record<string, unknown>).orderId || '').trim() : ''
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }

    const order = await db.marketplaceOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== guard.userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }
    if (order.status !== 'pending_payment' || order.paymentStatus !== 'unpaid') {
      return NextResponse.json(
        { success: false, error: 'এই অর্ডারের পেমেন্ট ইতিমধ্যে প্রক্রিয়াধীন বা সম্পন্ন' },
        { status: 409 },
      )
    }

    const appUrl = piprapayAppUrl()
    if (!appUrl) {
      return NextResponse.json({ success: false, error: 'App URL not configured' }, { status: 500 })
    }

    const user = await db.user.findUnique({
      where: { id: guard.userId },
      select: { name: true, email: true },
    })

    const result = await piprapayCreateCharge({
      fullName: user?.name || 'Customer',
      emailMobile: user?.email || '',
      amount: order.totalAmount,
      redirectUrl: `${appUrl}/api/marketplace/payment/success`,
      cancelUrl: `${appUrl}/api/marketplace/payment/cancel`,
      webhookUrl: `${appUrl}/api/marketplace/payment/webhook`,
      metadata: { order_id: order.id, mp: '1' },
    })

    if (!result.ok) {
      console.error('[mp-create-charge] gateway error:', result.error)
      return NextResponse.json(
        { success: false, error: 'পেমেন্ট গেটওয়ে সাময়িক সমস্যায় আছে — কিছুক্ষণ পর চেষ্টা করুন' },
        { status: 502 },
      )
    }

    // Persist the invoice BEFORE redirecting the customer
    await db.marketplaceOrder.update({
      where: { id: order.id },
      data: { piprapayInvoiceId: result.invoiceId },
    })

    return NextResponse.json({
      success: true,
      redirect_url: result.redirectUrl,
      invoice_id: result.invoiceId,
    })
  } catch (err) {
    console.error('[mp-create-charge] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
