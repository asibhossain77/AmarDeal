import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/orders/[id]/shipping — seller (owner) or admin updates
   the courier/tracking details of a PHYSICAL product order.

   Manual tracking updates only — there is no courier API behind
   this; the seller types what the courier handover produced.

   Allowed while the order is processing (pre-fill before the ship
   action), shipped or out_for_delivery. Once delivered/completed the
   record is locked — corrections go through admin dispute resolution.
   Buyers have no access to this route (they READ tracking info from
   GET /api/marketplace/orders/[id] instead).
   ═══════════════════════════════════════════════════════════════ */

const EDITABLE_STATUSES = ['processing', 'shipped', 'out_for_delivery']

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined // field not sent → leave untouched
  if (v === null || v === '') return null // explicit clear
  if (typeof v !== 'string') return undefined
  const d = new Date(v.length <= 10 ? `${v}T00:00:00.000Z` : v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { id } = await params
    const body = await req.json().catch(() => ({})) as {
      courierName?: string
      trackingNumber?: string
      dispatchDate?: string | null
      estimatedDeliveryDate?: string | null
      shippingNote?: string
    }

    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
        sellerId: true,
        productId: true,
        product: { select: { itemType: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'অর্ডার পাওয়া যায়নি', code: 'ORDER_NOT_FOUND' }, { status: 404 })
    }
    if (!order.productId) {
      return NextResponse.json({ error: 'অবৈধ অর্ডার টাইপ', code: 'INVALID_ORDER_TYPE' }, { status: 400 })
    }
    if (order.product?.itemType !== 'physical') {
      return NextResponse.json({ error: 'শুধুমাত্র ফিজিক্যাল পণ্যের অর্ডারে শিপিং তথ্য থাকে', code: 'NOT_PHYSICAL' }, { status: 400 })
    }
    if (!EDITABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: 'এই অবস্থায় শিপিং তথ্য পরিবর্তন করা যাবে না', code: 'INVALID_STATUS' },
        { status: 409 },
      )
    }

    // Role: seller (owner) or admin only — server-side, never client-claimed
    let role: 'seller' | 'admin' | null = null
    if (order.sellerId && order.sellerId === userId) role = 'seller'
    else {
      const admin = await db.admin.findUnique({ where: { userId }, select: { userId: true } })
      if (admin) role = 'admin'
    }
    if (!role) {
      return NextResponse.json({ error: 'এই অর্ডারের অনুমতি নেই', code: 'FORBIDDEN' }, { status: 403 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.courierName === 'string') {
      const v = body.courierName.trim()
      if (!v) return NextResponse.json({ error: 'কুরিয়ারের নাম খালি রাখা যাবে না', code: 'COURIER_REQUIRED' }, { status: 400 })
      data.courierName = v.slice(0, 80)
    }
    if (typeof body.trackingNumber === 'string') {
      const v = body.trackingNumber.trim()
      if (!v) return NextResponse.json({ error: 'ট্র্যাকিং নম্বর খালি রাখা যাবে না', code: 'TRACKING_REQUIRED' }, { status: 400 })
      data.trackingNumber = v.slice(0, 80)
    }
    const dispatch = parseDate(body.dispatchDate)
    if (dispatch !== undefined) data.dispatchDate = dispatch
    const estimated = parseDate(body.estimatedDeliveryDate)
    if (estimated !== undefined) data.estimatedDeliveryDate = estimated
    if (typeof body.shippingNote === 'string') {
      data.shippingNote = body.shippingNote.trim().slice(0, 500) || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'পরিবর্তনের জন্য কিছু দিন', code: 'NOTHING_TO_UPDATE' }, { status: 400 })
    }

    const updated = await db.marketplaceOrder.update({
      where: { id: order.id },
      data,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        courierName: true,
        trackingNumber: true,
        dispatchDate: true,
        estimatedDeliveryDate: true,
        shippingNote: true,
      },
    })

    // Audit trail — delivery record correction (no status change)
    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'delivery_updated',
        fromStatus: order.status,
        toStatus: order.status,
        message: `শিপিং তথ্য হালনাগাদ${updated.courierName ? ` — কুরিয়ার: ${updated.courierName}` : ''}${updated.trackingNumber ? ` · ট্র্যাকিং: ${updated.trackingNumber}` : ''}`,
        actorType: role,
        actorId: userId,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, order: updated })
  } catch (err) {
    console.error('[ORDER SHIPPING ERROR]', err)
    return NextResponse.json({ error: 'শিপিং তথ্য সংরক্ষণে সমস্যা হয়েছে' }, { status: 500 })
  }
}
