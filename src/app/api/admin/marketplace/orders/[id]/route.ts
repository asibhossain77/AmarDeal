import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { canAdminTransition, ORDER_STATUSES } from '@/lib/marketplace-pricing'
import { confirmMarketplaceOrderPayment } from '@/lib/marketplace-payments'
import { providerSubmitOrder, providerSyncOrder, mapProviderStatus } from '@/lib/smm-provider'

/* ═══════════════════════════════════════════════════════════
   GET   /api/admin/marketplace/orders/[id] — full detail
   PATCH /api/admin/marketplace/orders/[id] — admin actions

   ADMIN-ONLY. Actions (whitelisted, never mass-assigned):
   - verify_payment : confirm a manual payment (awaiting_verification → paid+queued)
   - reject_payment : reject a submitted manual payment (→ unpaid, retryable)
   - set_status     : guarded fulfilment transition + optional note/counts
   - note           : append an internal/customer-visible note
   - provider_submit: submit the order to the configured SMM provider
   - provider_sync  : sync status from the provider (auto-applies via guarded map)

   Every mutation writes a MarketplaceOrderEvent (audit trail).
   ═══════════════════════════════════════════════════════════ */

function sanitizeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, order })
  } catch (err) {
    console.error('[admin-mp-order] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response
  const adminId = guard.admin.userId
  const adminName = guard.admin.user.name

  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    const action = body && typeof body === 'object' ? sanitizeText((body as Record<string, unknown>).action, 32) : ''
    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 })
    }

    const order = await db.marketplaceOrder.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const b = (body || {}) as Record<string, unknown>

    /* ── Verify manual payment ── */
    if (action === 'verify_payment') {
      // Idempotent: already confirmed → report success without side effects
      if (order.paymentStatus === 'paid' && order.status !== 'pending_payment') {
        return NextResponse.json({ success: true, alreadyPaid: true })
      }
      if (order.status !== 'pending_payment' || order.paymentStatus !== 'awaiting_verification') {
        return NextResponse.json(
          { success: false, error: 'এই অর্ডারে যাচাইয়ের মতো পেমেন্ট নেই' },
          { status: 409 },
        )
      }
      // Admin has manually confirmed the money arrived → confirm with the
      // order's own trusted total (amount cross-check passes by definition).
      const result = await confirmMarketplaceOrderPayment({
        orderId: order.id,
        amount: order.totalAmount,
        currency: 'BDT',
        verifiedBy: adminId,
      })
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 409 })
      }
      return NextResponse.json({ success: true })
    }

    /* ── Reject manual payment ── */
    if (action === 'reject_payment') {
      if (order.paymentStatus !== 'awaiting_verification' || order.status !== 'pending_payment') {
        return NextResponse.json({ success: false, error: 'Reject করার মতো পেমেন্ট নেই' }, { status: 409 })
      }
      const reason = sanitizeText(b.reason, 300) || 'Payment could not be verified'
      const updated = await db.marketplaceOrder.updateMany({
        where: { id: order.id, status: 'pending_payment', paymentStatus: 'awaiting_verification' },
        data: {
          paymentStatus: 'failed',
          status: 'pending_payment',
          paymentMethodName: null,
          paymentMethodId: null,
          senderNumber: null,
          transactionId: null,
        },
      })
      if (updated.count === 0) {
        return NextResponse.json({ success: false, error: 'State changed, try again' }, { status: 409 })
      }
      // failed → unpaid so the customer can retry
      await db.marketplaceOrder.update({
        where: { id: order.id },
        data: { paymentStatus: 'unpaid' },
      })
      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'payment_failed',
          message: `Manual payment rejected by admin: ${reason}`,
          actorType: 'admin',
          actorId: adminId,
          actorName: adminName,
        },
      })
      return NextResponse.json({ success: true })
    }

    /* ── Status transition ── */
    if (action === 'set_status') {
      const toStatus = sanitizeText(b.status, 24)
      if (!(ORDER_STATUSES as readonly string[]).includes(toStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
      }
      if (!canAdminTransition(order.status, toStatus)) {
        return NextResponse.json(
          { success: false, error: `"${order.status}" থেকে "${toStatus}" এ যাওয়া অনুমোদিত নয়` },
          { status: 409 },
        )
      }
      const note = sanitizeText(b.note, 500)
      const data: Record<string, unknown> = { status: toStatus }
      if (note) data.fulfilmentNote = note
      if (b.startCount !== undefined && b.startCount !== null && Number.isFinite(Number(b.startCount))) {
        data.startCount = Number(b.startCount)
      }
      if (b.remains !== undefined && b.remains !== null && Number.isFinite(Number(b.remains))) {
        data.remains = Number(b.remains)
      }
      if (toStatus === 'cancelled') data.cancelReason = note || 'cancelled_by_admin'
      if (toStatus === 'refunded') {
        // Refund is an offline money movement — record it, mark unpaid-refunded
        data.paymentStatus = 'unpaid'
      }

      const updated = await db.marketplaceOrder.updateMany({
        where: { id: order.id, status: order.status }, // guard against racing transitions
        data,
      })
      if (updated.count === 0) {
        return NextResponse.json({ success: false, error: 'State changed, try again' }, { status: 409 })
      }

      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'status_changed',
          fromStatus: order.status,
          toStatus,
          message: note || `Status changed to ${toStatus}`,
          actorType: 'admin',
          actorId: adminId,
          actorName: adminName,
        },
      })

      if (toStatus !== order.status) {
        const { notifyUser } = await import('@/lib/push')
        notifyUser({
          userId: order.userId,
          type: 'order_status_changed',
          title: 'অর্ডার স্ট্যাটাস আপডেট',
          message: `অর্ডার ${order.orderNumber} এখন "${toStatus.replace(/_/g, ' ')}" অবস্থায় আছে।`,
          pushUrl: `/dashboard/orders/${order.id}`,
        }).catch(() => {})
      }

      return NextResponse.json({ success: true })
    }

    /* ── Fulfilment note ── */
    if (action === 'note') {
      const note = sanitizeText(b.note, 500)
      if (!note) return NextResponse.json({ success: false, error: 'note is required' }, { status: 400 })
      await db.marketplaceOrder.update({
        where: { id: order.id },
        data: { fulfilmentNote: note },
      })
      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'note',
          message: note,
          actorType: 'admin',
          actorId: adminId,
          actorName: adminName,
        },
      })
      return NextResponse.json({ success: true })
    }

    /* ── Provider submit ── */
    if (action === 'provider_submit') {
      if (order.paymentStatus !== 'paid') {
        return NextResponse.json({ success: false, error: 'অর্ডারটি এখনো পেইড নয়' }, { status: 409 })
      }
      if (!['queued', 'failed'].includes(order.status)) {
        return NextResponse.json(
          { success: false, error: 'শুধু queued বা failed অর্ডার প্রোভাইডারে পাঠানো যায়' },
          { status: 409 },
        )
      }
      if (order.providerOrderId) {
        return NextResponse.json({ success: false, error: 'ইতিমধ্যে প্রোভাইডারে জমা হয়েছে' }, { status: 409 })
      }
      const service = await db.marketplaceService.findUnique({
        where: { id: order.serviceId },
        select: { providerServiceId: true, providerName: true },
      })
      if (!service?.providerServiceId) {
        return NextResponse.json(
          { success: false, error: 'সার্ভিসে প্রোভাইডার ম্যাপিং নেই — ম্যানুয়াল ফালফিলমেন্ট ব্যবহার করুন' },
          { status: 409 },
        )
      }

      const result = await providerSubmitOrder({
        providerServiceId: service.providerServiceId,
        link: order.linkUrl,
        quantity: order.quantity,
      })

      if (!result.ok) {
        // Order stays in its current state — provider failure never completes it
        await db.marketplaceOrder.update({
          where: { id: order.id },
          data: { providerError: result.error },
        })
        await db.marketplaceOrderEvent.create({
          data: {
            orderId: order.id,
            type: 'provider_error',
            message: `Provider submit failed: ${result.error}`,
            actorType: 'admin',
            actorId: adminId,
            actorName: adminName,
          },
        })
        return NextResponse.json({ success: false, error: `প্রোভাইডার সাবমিট ব্যর্থ: ${result.error}` }, { status: 502 })
      }

      await db.marketplaceOrder.update({
        where: { id: order.id },
        data: {
          providerOrderId: result.providerOrderId,
          providerStatus: null,
          providerError: null,
          providerSyncedAt: new Date(),
        },
      })
      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'provider_submitted',
          message: `Submitted to provider — ref ${result.providerOrderId}. Order NOT marked complete until delivery is confirmed.`,
          actorType: 'admin',
          actorId: adminId,
          actorName: adminName,
        },
      })
      return NextResponse.json({ success: true, providerOrderId: result.providerOrderId })
    }

    /* ── Provider sync ── */
    if (action === 'provider_sync') {
      if (!order.providerOrderId) {
        return NextResponse.json({ success: false, error: 'কোনো প্রোভাইডার অর্ডার নেই' }, { status: 409 })
      }
      const result = await providerSyncOrder(order.providerOrderId)
      if (!result.ok) {
        await db.marketplaceOrder.update({
          where: { id: order.id },
          data: { providerError: result.error },
        })
        return NextResponse.json({ success: false, error: `সিঙ্ক ব্যর্থ: ${result.error}` }, { status: 502 })
      }

      const mapped = result.status ? mapProviderStatus(result.status) : null
      const data: Record<string, unknown> = {
        providerStatus: result.status,
        providerSyncedAt: new Date(),
        providerError: null,
      }
      if (result.startCount !== null && result.startCount !== undefined) data.startCount = result.startCount
      if (result.remains !== null && result.remains !== undefined) data.remains = result.remains

      let applied: string | null = null
      if (mapped && canAdminTransition(order.status, mapped)) {
        data.status = mapped
        applied = mapped
      }

      await db.marketplaceOrder.update({ where: { id: order.id }, data })
      await db.marketplaceOrderEvent.create({
        data: {
          orderId: order.id,
          type: 'provider_synced',
          fromStatus: order.status,
          toStatus: applied || undefined,
          message: `Provider status: "${result.status}"${applied ? ` → order status "${applied}"` : ' (informational)'}${result.remains !== null && result.remains !== undefined ? `, remains ${result.remains}` : ''}`,
          actorType: 'admin',
          actorId: adminId,
          actorName: adminName,
        },
      })

      if (applied && applied !== order.status) {
        const { notifyUser } = await import('@/lib/push')
        notifyUser({
          userId: order.userId,
          type: 'order_status_changed',
          title: 'অর্ডার স্ট্যাটাস আপডেট',
          message: `অর্ডার ${order.orderNumber} এখন "${applied.replace(/_/g, ' ')}" অবস্থায় আছে।`,
          pushUrl: `/dashboard/orders/${order.id}`,
        }).catch(() => {})
      }

      return NextResponse.json({ success: true, providerStatus: result.status, applied })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[admin-mp-order] PATCH error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
