import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { notifyUser } from '@/lib/push'
import {
  canResumeAfterDispute,
  clipText,
  isDisputeOutcome,
  logAdminAction,
} from '@/lib/order-protection'

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/admin/order-disputes/[id] — admin dispute resolution.

   Actions:
   - under_review  open → under_review
   - resolve       resolution note REQUIRED + outcome:
       complete  → order → completed
       cancel    → order → cancelled (never from completed orders)
       refund    → order stays; an APPROVED RefundRequest is spawned —
                   the money still moves only after the admin records
                   the verified manual refund in the refund panel
       rejected  → dispute dismissed; a non-completed 'disputed' order
                   resumes its pre-dispute status
       none      → decision recorded, order untouched
   - reject_dispute  shorthand for resolve with outcome 'rejected'

   Every resolution writes the timestamped decision, notifies both
   parties, and lands in AdminAuditLog.
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
      resolution?: string
      outcome?: string
    }
    const action = body.action

    const dispute = await db.orderDispute.findUnique({
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
    if (!dispute) {
      return NextResponse.json({ success: false, error: 'বিরোধ পাওয়া যায়নি' }, { status: 404 })
    }
    if (dispute.status === 'resolved' || dispute.status === 'rejected') {
      return NextResponse.json({ success: false, error: 'এই বিরোধ ইতিমধ্যে মীমাংসা হয়েছে' }, { status: 409 })
    }

    const admin = guard.admin
    const order = dispute.order
    const productTitle = order.product?.title ?? order.serviceName

    // ── under_review ────────────────────────────────────────────
    if (action === 'under_review') {
      if (dispute.status !== 'open') {
        return NextResponse.json({ success: false, error: 'এই পরিবর্তন সম্ভব নয়' }, { status: 409 })
      }
      const updated = await db.orderDispute.update({
        where: { id: dispute.id },
        data: { status: 'under_review' },
      })
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name, action: 'dispute_under_review',
        targetType: 'dispute', targetId: dispute.id, orderId: order.id,
      })
      return NextResponse.json({ success: true, dispute: updated })
    }

    // ── resolve / reject_dispute ────────────────────────────────
    if (action === 'resolve' || action === 'reject_dispute') {
      const resolution = clipText(body.resolution, 1000)
      const outcome = action === 'reject_dispute' ? 'rejected' : body.outcome
      if (!resolution) {
        return NextResponse.json({ success: false, error: 'মীমাংসার নোট লিখুন' }, { status: 400 })
      }
      if (!isDisputeOutcome(outcome)) {
        return NextResponse.json({ success: false, error: 'অবৈধ ফলাফল' }, { status: 400 })
      }
      if (action === 'resolve' && !['refund', 'cancel', 'complete', 'rejected', 'none'].includes(outcome as string)) {
        return NextResponse.json({ success: false, error: 'অবৈধ ফলাফল' }, { status: 400 })
      }

      const now = new Date()
      let orderUpdate: Record<string, unknown> | null = null
      let refundRequestId: string | null = null

      if (outcome === 'complete') {
        if (order.status !== 'completed') {
          orderUpdate = { status: 'completed', completedAt: now }
        }
      } else if (outcome === 'cancel') {
        if (order.status === 'completed') {
          return NextResponse.json(
            { success: false, error: 'সম্পন্ন হওয়া অর্ডার বাতিল করা যাবে না — রিফান্ড ফলাফল ব্যবহার করুন' },
            { status: 409 },
          )
        }
        orderUpdate = {
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: 'admin',
          cancelReason: clipText(`dispute_resolved: ${resolution}`, 500),
        }
      } else if (outcome === 'refund') {
        // Money moves ONLY after the admin records a verified manual
        // refund — the dispute resolution merely approves the refund.
        const existing = await db.refundRequest.findUnique({ where: { orderId: order.id } })
        if (!existing) {
          const refund = await db.refundRequest.create({
            data: {
              orderId: order.id,
              requestedById: order.userId,
              reason: `বিরোধ মীমাংসার সিদ্ধান্ত — ${resolution}`,
              amount: order.totalAmount,
              status: 'approved',
              adminNote: resolution,
              reviewedById: admin.userId,
              reviewedAt: now,
            },
          })
          refundRequestId = refund.id
        } else if (existing.status !== 'refunded') {
          refundRequestId = existing.id
          await db.refundRequest.update({
            where: { id: existing.id },
            data: { status: 'approved', adminNote: resolution, reviewedById: admin.userId, reviewedAt: now },
          })
        }
      } else if (outcome === 'rejected') {
        // Dismissed claim: resume the order's pre-dispute status so
        // fulfilment can continue.
        if (
          order.status === 'disputed' &&
          canResumeAfterDispute(dispute.preDisputeStatus)
        ) {
          orderUpdate = { status: dispute.preDisputeStatus as string }
        }
      }

      const [updated] = await db.$transaction([
        db.orderDispute.update({
          where: { id: dispute.id },
          data: {
            status: outcome === 'rejected' ? 'rejected' : 'resolved',
            resolution,
            outcome,
            resolvedById: admin.userId,
            resolvedAt: now,
          },
        }),
        ...(orderUpdate
          ? [db.marketplaceOrder.update({ where: { id: order.id }, data: orderUpdate })]
          : []),
      ])

      // ── Phase 7: seller ledger — dispute resolved as COMPLETE earns the
      // seller their gross sale + commission snapshot (idempotent) ──
      if (outcome === 'complete' && orderUpdate && order.sellerId) {
        const { recordMarketplaceSale } = await import('@/lib/seller-ledger')
        await recordMarketplaceSale({
          orderId: order.id,
          sellerId: order.sellerId,
          totalAmount: order.totalAmount,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
        })
      }

      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'dispute_resolved',
          fromStatus: order.status,
          toStatus: (orderUpdate?.status as string) ?? order.status,
          message: `বিরোধ মীমাংসা (${outcome === 'rejected' ? 'প্রত্যাখ্যাত' : outcome}): ${resolution}`,
          actorType: 'admin',
          actorId: admin.userId,
          actorName: admin.user.name,
        },
      }).catch(() => {})

      // Notify BOTH parties with the decision + what it means for them.
      const outcomeBn: Record<string, string> = {
        refund: 'রিফান্ড অনুমোদিত হয়েছে — যাচাইয়ের পর টাকা পাঠানো হবে',
        cancel: 'অর্ডার বাতিল করা হয়েছে',
        complete: 'অর্ডার সম্পন্ন হিসেবে চিহ্নিত হয়েছে',
        rejected: 'বিরোধটি প্রত্যাখ্যাত হয়েছে',
        none: 'সিদ্ধান্ত রেকর্ড করা হয়েছে',
      }
      const baseMsg = `"${productTitle}" অর্ডারের (${order.orderNumber}) বিরোধ মীমাংসা হয়েছে: ${outcomeBn[outcome]}। নোট: ${resolution}`
      notifyUser({
        userId: order.userId, type: 'order_dispute_resolved',
        title: 'বিরোধ মীমাংসা হয়েছে', message: baseMsg,
        relatedType: 'order', relatedId: order.id,
      }).catch(() => {})
      if (order.sellerId) {
        notifyUser({
          userId: order.sellerId, type: 'order_dispute_resolved',
          title: 'বিরোধ মীমাংসা হয়েছে', message: baseMsg,
          relatedType: 'order', relatedId: order.id,
        }).catch(() => {})
      }
      await logAdminAction({
        adminId: admin.userId, adminName: admin.user.name,
        action: outcome === 'rejected' ? 'dispute_reject' : 'dispute_resolve',
        targetType: 'dispute', targetId: dispute.id, orderId: order.id,
        details: { outcome, resolution, refundRequestId, orderUpdate: orderUpdate ?? null },
      })
      return NextResponse.json({ success: true, dispute: updated })
    }

    return NextResponse.json({ success: false, error: 'অজানা অ্যাকশন' }, { status: 400 })
  } catch (err) {
    console.error('[admin-dispute PATCH] error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
