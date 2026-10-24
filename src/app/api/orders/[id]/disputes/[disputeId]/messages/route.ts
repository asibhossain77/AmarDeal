import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'
import { notifyUser } from '@/lib/push'
import { clipText, sanitizeEvidence } from '@/lib/order-protection'

/* ═══════════════════════════════════════════════════════════════
   POST /api/orders/[id]/disputes/[disputeId]/messages

   Both parties + the reviewing admin post to the timestamped
   dispute thread while it is open / under review. Attachments ride
   the order-scoped evidence space (R2 `evidence/<orderId>/…`).
   The counterparty is notified — the sender never is.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disputeId: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id, disputeId } = await params
    const body = await req.json().catch(() => ({})) as {
      text?: string
      attachments?: unknown
    }
    const text = clipText(body.text, 2000)
    if (!text) {
      return NextResponse.json({ success: false, error: 'বার্তা লিখুন' }, { status: 400 })
    }

    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      select: { id: true, userId: true, sellerId: true, orderNumber: true },
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

    const dispute = await db.orderDispute.findUnique({ where: { id: disputeId } })
    if (!dispute || dispute.orderId !== order.id) {
      return NextResponse.json({ success: false, error: 'বিরোধ পাওয়া যায়নি' }, { status: 404 })
    }
    if (!['open', 'under_review'].includes(dispute.status)) {
      return NextResponse.json(
        { success: false, error: 'মীমাংসা হওয়া বিরোধে নতুন বার্তা যোগ করা যাবে না' },
        { status: 409 },
      )
    }

    const senderRole: 'buyer' | 'seller' | 'admin' = isAdmin ? 'admin' : isBuyer ? 'buyer' : 'seller'
    const attachments = sanitizeEvidence(body.attachments, order.id)

    const message = await db.orderDisputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: guard.userId,
        senderRole,
        text,
        attachments: attachments.length ? JSON.stringify(attachments) : null,
      },
    })

    // Notify the counterparty (never the sender); admin messages reach both.
    const targets = new Set<string>()
    if (senderRole === 'buyer') {
      if (order.sellerId) targets.add(order.sellerId)
    } else if (senderRole === 'seller') {
      targets.add(order.userId)
    } else {
      targets.add(order.userId)
      if (order.sellerId) targets.add(order.sellerId)
    }
    for (const userId of targets) {
      notifyUser({
        userId,
        type: 'order_dispute_message',
        title: 'বিরোধে নতুন বার্তা',
        message: `অর্ডার ${order.orderNumber}-এর বিরোধে ${senderRole === 'admin' ? 'অ্যাডমিন' : senderRole === 'buyer' ? 'ক্রেতা' : 'বিক্রেতা'} নতুন বার্তা দিয়েছেন — অর্ডার পেজে দেখুন।`,
        relatedType: 'order',
        relatedId: order.id,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, message })
  } catch (err) {
    console.error('[dispute-message POST] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
