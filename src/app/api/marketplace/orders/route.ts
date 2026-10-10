import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { notifyAdmins } from '@/lib/push'
import {
  calculateOrderTotal,
  isValidQuantity,
  validateQuantityAgainstService,
  validateLinkUrl,
  generateOrderNumber,
} from '@/lib/marketplace-pricing'
import { getDisabledCategories } from '@/lib/marketplace-categories'

/* ═══════════════════════════════════════════════════════════
   GET  /api/marketplace/orders — the current user's own orders
   POST /api/marketplace/orders — place a new direct order

   SECURITY:
   - Listing requires auth and always filters by the session user
     (no client-supplied userId is ever trusted).
   - Order creation validates the service is PUBLISHED, quantity
     bounds, and the target link — all server-side.
   - The total amount is ALWAYS computed here from the service's
     stored price. Client-sent price/amount fields are ignored.
   - Idempotency: a client-generated idempotencyKey (unique in DB)
     makes retries/double-clicks return the same order instead of
     creating duplicates.
   ═══════════════════════════════════════════════════════════ */

function sanitizeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const take = Math.min(Number(searchParams.get('take')) || 50, 100)
    const skip = Math.max(Number(searchParams.get('skip')) || 0, 0)

    const where: Record<string, unknown> = { userId: guard.userId }
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      db.marketplaceOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          orderNumber: true,
          serviceName: true,
          linkUrl: true,
          quantity: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
      db.marketplaceOrder.count({ where }),
    ])

    return NextResponse.json({ success: true, orders, total })
  } catch (err) {
    console.error('[marketplace-orders] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response
  const userId = guard.userId

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const serviceId = sanitizeText((body as Record<string, unknown>).serviceId, 64)
    const idempotencyKey = sanitizeText((body as Record<string, unknown>).idempotencyKey, 64)
    const linkTypeRaw = sanitizeText((body as Record<string, unknown>).linkType, 32)
    const quantityRaw = (body as Record<string, unknown>).quantity

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service is required' }, { status: 400 })
    }
    if (!idempotencyKey || idempotencyKey.length < 8) {
      return NextResponse.json({ success: false, error: 'Invalid idempotency key' }, { status: 400 })
    }

    // Idempotency — return the existing order for a replayed request
    const existing = await db.marketplaceOrder.findUnique({ where: { idempotencyKey } })
    if (existing) {
      if (existing.userId !== userId) {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 409 })
      }
      return NextResponse.json({ success: true, order: existing, existing: true })
    }

    // Link validation (server-side, http/https only)
    const linkCheck = validateLinkUrl((body as Record<string, unknown>).link)
    if (!linkCheck.ok) {
      const messages: Record<string, string> = {
        required: 'টার্গেট লিংক দিন',
        invalid: 'লিংকটি সঠিক নয় — সম্পূর্ণ URL দিন (https://...)',
        invalid_protocol: 'শুধুমাত্র http/https লিংক গ্রহণযোগ্য',
        too_long: 'লিংকটি খুব দীর্ঘ',
      }
      return NextResponse.json(
        { success: false, error: messages[linkCheck.reason] || 'লিংকটি সঠিক নয়' },
        { status: 400 },
      )
    }

    // Quantity validation (strict positive integer, service bounds)
    if (!isValidQuantity(quantityRaw)) {
      return NextResponse.json(
        { success: false, error: 'পরিমাণ অবশ্যই একটি পূর্ণ সংখ্যা হতে হবে (১ বা তার বেশি)' },
        { status: 400 },
      )
    }

    // Fetch the service — MUST be published and active
    const service = await db.marketplaceService.findUnique({ where: { id: serviceId } })
    if (!service || service.status !== 'published' || !service.isActive) {
      return NextResponse.json(
        { success: false, error: 'এই সার্ভিসটি এখন গ্রহণযোগ্য নয়' },
        { status: 404 },
      )
    }

    // Its category must be switched ON by the admin.
    // (Existing orders are unaffected — this only gates NEW orders.)
    const disabledCategories = await getDisabledCategories()
    if (disabledCategories.has(service.category)) {
      return NextResponse.json(
        { success: false, error: 'এই ক্যাটাগরিটি সাময়িকভাবে বন্ধ আছে — অর্ডার নেওয়া যাচ্ছে না' },
        { status: 400 },
      )
    }

    const bounds = validateQuantityAgainstService(quantityRaw, service.minQuantity, service.maxQuantity)
    if (!bounds.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            bounds.reason === 'below_min'
              ? `সর্বনিম্ন পরিমাণ ${service.minQuantity}`
              : `সর্বোচ্চ পরিমাণ ${service.maxQuantity}`,
        },
        { status: 400 },
      )
    }

    // Link type check — when the service declares supported link types
    let linkType: string | null = null
    const allowedTypes = JSON.parse(service.linkTypes || '[]') as string[]
    if (Array.isArray(allowedTypes) && allowedTypes.length > 0) {
      if (!linkTypeRaw || !allowedTypes.includes(linkTypeRaw)) {
        return NextResponse.json(
          { success: false, error: 'সার্ভিসটির জন্য সঠিক লিংক টাইপ নির্বাচন করুন' },
          { status: 400 },
        )
      }
      linkType = linkTypeRaw
    }

    // ── Trusted server-side pricing (client price is never read) ──
    // "per_1000" is currently the only configured pricing unit.
    const unit = 'per_1000'
    const totalAmount = calculateOrderTotal(service.pricePerThousand, quantityRaw, unit)

    // Generate a collision-safe order number
    let orderNumber = generateOrderNumber()
    for (let i = 0; i < 5; i++) {
      const clash = await db.marketplaceOrder.findUnique({ where: { orderNumber } })
      if (!clash) break
      orderNumber = generateOrderNumber()
    }

    const order = await db.marketplaceOrder.create({
      data: {
        orderNumber,
        userId,
        serviceId: service.id,
        serviceName: service.name,
        linkUrl: linkCheck.url,
        linkType,
        quantity: quantityRaw,
        pricingUnit: unit,
        unitPriceAtOrder: service.pricePerThousand,
        totalAmount,
        status: 'pending_payment',
        paymentStatus: 'unpaid',
        idempotencyKey,
      },
    })

    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'created',
        toStatus: 'pending_payment',
        message: `Order placed — ${quantityRaw} units × ৳${service.pricePerThousand} per 1,000 = ৳${totalAmount.toFixed(2)}`,
        actorType: 'user',
        actorId: userId,
      },
    })

    notifyAdmins({
      type: 'marketplace_order_new',
      title: 'নতুন মার্কেটপ্লেস অর্ডার',
      message: `${order.orderNumber} — ${service.name} (৳${totalAmount.toFixed(2)}) পেমেন্টের অপেক্ষায়`,
    }).catch(() => {})

    return NextResponse.json({ success: true, order }, { status: 201 })
  } catch (err: unknown) {
    // Unique-constraint race on idempotencyKey → fetch and return the winner
    if (
      typeof err === 'object' && err !== null && 'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      const existing = await db.marketplaceOrder
        .findUnique({ where: { idempotencyKey: sanitizeText((await req.json().catch(() => ({})))?.idempotencyKey, 64) } })
        .catch(() => null)
      if (existing) {
        return NextResponse.json({ success: true, order: existing, existing: true })
      }
    }
    console.error('[marketplace-orders] POST error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
