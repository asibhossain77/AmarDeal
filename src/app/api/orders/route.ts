import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import {
  clampQuantity,
  isOrderStatus,
  notifySellerNewOrder,
  OPEN_ORDER_STATUSES,
  FULFILMENT_STATUSES,
} from '@/lib/orders'
import { generateOrderNumber } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════════
   POST /api/orders — create a NORMAL marketplace product order
   ("Order Now" on a product page).

   ⛔ SEPARATION GUARANTEE: this route NEVER creates a Deal, escrow
   record, deal chat, or any deal payment flow. It only writes a
   MarketplaceOrder row (productId set, serviceId null) + seller
   notification.

   Trust rules:
   - unitPriceAtOrder/totalAmount are computed SERVER-SIDE from the
     product/option rows — client-sent prices are ignored.
   - Repeated submissions with the same clientRequestId return the
     SAME order (idempotencyKey unique) instead of duplicating.

   GET /api/orders?role=seller — the SELLER's product orders list
   (strict sellerId = session user; another seller's orders can
   never appear). Powers the Seller Dashboard Orders page:
   per-status counts are computed from the caller's FULL order set
   (summary cards reflect real data, not the active filter).
   ═══════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json().catch(() => ({}))
    const {
      productId,
      optionId,
      quantity,
      customerNote,
      targetLink,
      clientRequestId,
      // Phase 3: physical delivery info
      buyerName,
      buyerPhone,
      addressLine,
      city,
      postalCode,
      deliveryNote,
    } = body as {
      productId?: string
      optionId?: string
      quantity?: number
      customerNote?: string
      targetLink?: string
      clientRequestId?: string
      buyerName?: string
      buyerPhone?: string
      addressLine?: string
      city?: string
      postalCode?: string
      deliveryNote?: string
    }

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'পণ্য আইডি প্রয়োজন' }, { status: 400 })
    }

    // ── Idempotency: same clientRequestId → return the existing order ──
    const reqId =
      typeof clientRequestId === 'string' && clientRequestId.length > 0 && clientRequestId.length <= 80
        ? clientRequestId
        : null
    if (reqId) {
      const existing = await db.marketplaceOrder.findUnique({ where: { idempotencyKey: reqId } })
      if (existing) {
        if (existing.userId !== userId) {
          return NextResponse.json(
            { error: 'এই রিকোয়েস্ট আইডি অন্য ইউজারের', code: 'REQUEST_ID_TAKEN' },
            { status: 409 },
          )
        }
        return NextResponse.json({ success: true, idempotent: true, order: serializeOrderLite(existing) })
      }
    }

    // ── Load product + seller (server-side truth) ──
    const product = await db.digitalProduct.findUnique({
      where: { id: productId },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            isSeller: true,
            sellerDisabled: true,
            // Phase 4: direct orders are for Verified Business Sellers
            // (physical AND digital) — personal digital sellers keep the
            // Admin Deal / Message workflow only.
            sellerRole: true,
            admin: { select: { userId: true } },
          },
        },
      },
    })

    if (!product || product.status !== 'active') {
      return NextResponse.json({ error: 'পণ্য পাওয়া যায়নি বা নিষ্ক্রিয়' }, { status: 404 })
    }

    if (product.sellerId === userId) {
      return NextResponse.json({ error: 'আপনি নিজের পণ্য অর্ডার করতে পারবেন না' }, { status: 400 })
    }

    if (product.seller.sellerDisabled) {
      return NextResponse.json({ error: 'এই সেলার বর্তমানে অর্ডার গ্রহণ করছেন না' }, { status: 400 })
    }

    const isPlatformOwned = !!product.seller.admin

    // ── Phase 4: Order Now eligibility — physical AND digital products ──
    // Eligible = platform-owned (admin-sold, Task 62/81 flow preserved) OR
    // a Verified Business Seller's product (physical or digital). Personal
    // digital sellers keep the Admin Deal / Message workflow only — they do
    // not have the order dashboard required to fulfil direct orders.
    // The client hides the button, but THIS is the security boundary:
    // eligibility is re-checked here on every submission.
    const isBusinessSeller = product.seller.sellerRole === 'business'
    if (!isPlatformOwned && !isBusinessSeller) {
      return NextResponse.json(
        { error: 'এই পণ্যটি সরাসরি অর্ডার করা যাবে না — Admin Deal বা মেসেজ ব্যবহার করুন', code: 'ORDER_NOT_ALLOWED' },
        { status: 403 },
      )
    }

    const isPhysicalOrder = product.itemType === 'physical'
    // Physical orders never use SMM-style option packages (enforced at
    // creation); this is defense-in-depth against tampered rows.
    if (isPhysicalOrder && product.productType === 'multi') {
      return NextResponse.json({ error: 'অবৈধ পণ্য কনফিগারেশন' }, { status: 400 })
    }

    // ── Multi-price products: verify the option server-side, use ITS price ──
    let unitPrice = product.price
    let verifiedOptionId: string | null = null
    let optionName: string | null = null
    if (product.productType === 'multi') {
      if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json({ error: 'অনুগ্রহ করে একটি অপশন/প্যাকেজ নির্বাচন করুন' }, { status: 400 })
      }
      const option = await db.productOption.findUnique({ where: { id: optionId } })
      if (!option || option.productId !== product.id) {
        return NextResponse.json({ error: 'অবৈধ অপশন — এটি এই পণ্যের কোনো অপশন নয়' }, { status: 400 })
      }
      if (!option.isAvailable || !(option.price > 0)) {
        return NextResponse.json({ error: 'এই অপশনটি বর্তমানে অর্ডারযোগ্য নয়' }, { status: 400 })
      }
      unitPrice = option.price
      verifiedOptionId = option.id
      optionName = option.name
    }

    const qty = clampQuantity(quantity)
    // Trusted server-side total — client numbers never reach the DB
    const totalAmount = Math.round(unitPrice * qty * 100) / 100

    // Physical items have real stock — the order must fit within it.
    // (checked here, after qty is clamped; the decrement itself is atomic
    // inside the creation transaction below)
    if (isPhysicalOrder && product.quantity < qty) {
      return NextResponse.json(
        { error: 'অপর্যাপ্ত স্টক — অর্ডারের পরিমাণ স্টকের চেয়ে বেশি', code: 'INSUFFICIENT_STOCK' },
        { status: 400 },
      )
    }

    // Free digital products go through the claim/download flow, not paid orders
    if (product.isFree) {
      return NextResponse.json({ error: 'এই পণ্যটি ফ্রি — ডাউনলোড পেজ থেকে সংগ্রহ করুন' }, { status: 400 })
    }

    const note = typeof customerNote === 'string' ? customerNote.trim().slice(0, 1000) || null : null
    const link =
      typeof targetLink === 'string' && /^https?:\/\/.+/i.test(targetLink.trim())
        ? targetLink.trim().slice(0, 500)
        : null

    // ── Phase 4: digital fulfilment info — for a Verified Business Seller's
    //    account/license/subscription products the seller CANNOT deliver
    //    without the buyer's credentials (game ID etc.), so customerNote is
    //    REQUIRED — backend-enforced, mirroring the checkout form.
    //    Platform-owned products keep the legacy flow (never required). ──
    const FULFILMENT_KINDS = ['account', 'license', 'subscription']
    if (
      !isPhysicalOrder &&
      !isPlatformOwned &&
      isBusinessSeller &&
      FULFILMENT_KINDS.includes(product.digitalKind ?? '') &&
      !note
    ) {
      return NextResponse.json(
        { error: 'অর্ডার পূরণের তথ্য (গেম আইডি / একাউন্ট তথ্য) প্রয়োজন', code: 'FULFILMENT_INFO_REQUIRED' },
        { status: 400 },
      )
    }

    // ── Phase 3: physical delivery info — required for physical orders.
    //    Phase 4: digital orders store the buyer contact (OPTIONAL — the
    //    session user is already on the order) so the seller can reach the
    //    buyer; fulfilment info rides on customerNote. Delivery address
    //    fields stay null for digital orders. Visible only to
    //    buyer/seller/admin — never public. ──
    let delivery: {
      buyerName: string | null
      buyerPhone: string | null
      addressLine: string | null
      city: string | null
      postalCode: string | null
      deliveryNote: string | null
    } = {
      buyerName: null, buyerPhone: null, addressLine: null,
      city: null, postalCode: null, deliveryNote: null,
    }
    if (isPhysicalOrder) {
      const dName = typeof buyerName === 'string' ? buyerName.trim().slice(0, 120) : ''
      const dPhone = typeof buyerPhone === 'string' ? buyerPhone.trim().slice(0, 30) : ''
      const dAddress = typeof addressLine === 'string' ? addressLine.trim().slice(0, 300) : ''
      if (!dName || !dPhone || !dAddress) {
        return NextResponse.json(
          { error: 'ফিজিক্যাল পণ্যের জন্য প্রাপকের নাম, ফোন নম্বর ও সম্পূর্ণ ঠিকানা প্রয়োজন', code: 'DELIVERY_INFO_REQUIRED' },
          { status: 400 },
        )
      }
      delivery = {
        buyerName: dName,
        buyerPhone: dPhone,
        addressLine: dAddress,
        city: typeof city === 'string' ? city.trim().slice(0, 80) || null : null,
        postalCode: typeof postalCode === 'string' ? postalCode.trim().slice(0, 20) || null : null,
        deliveryNote: typeof deliveryNote === 'string' ? deliveryNote.trim().slice(0, 500) || null : null,
      }
    } else {
      // Digital: optional contact (sanitized, never required, no address)
      const dName = typeof buyerName === 'string' ? buyerName.trim().slice(0, 120) : ''
      const dPhone = typeof buyerPhone === 'string' ? buyerPhone.trim().slice(0, 30) : ''
      if (dName) delivery.buyerName = dName
      if (dPhone) delivery.buyerPhone = dPhone
    }

    // ── Create with order-number collision retry ──
    // Physical orders decrement stock ATOMICALLY: the guarded updateMany
    // (quantity >= qty) and the order INSERT commit or roll back together,
    // so concurrent checkouts can never oversell the last unit.
    class StockConflict extends Error {}
    let order: {
      id: string; orderNumber: string; status: string; paymentStatus: string
      quantity: number; unitPriceAtOrder: number; totalAmount: number
      serviceName: string; createdAt: Date; sellerId: string | null; userId: string
    } | null = null
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const createData = {
          orderNumber: generateOrderNumber(),
          idempotencyKey: reqId ?? `srv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          userId,
          sellerId: product.sellerId,
          productId: product.id,
          productOptionId: verifiedOptionId,
          serviceName: optionName ? `${product.title} — ${optionName}` : product.title,
          quantity: qty,
          pricingUnit: 'unit',
          unitPriceAtOrder: unitPrice,
          totalAmount,
          status: 'pending_payment',
          paymentStatus: 'unpaid',
          customerNote: note,
          linkUrl: link,
          ...delivery,
        }
        if (isPhysicalOrder) {
          order = await db.$transaction(async (tx) => {
            const upd = await tx.digitalProduct.updateMany({
              where: { id: product.id, quantity: { gte: qty } },
              data: { quantity: { decrement: qty } },
            })
            if (upd.count !== 1) throw new StockConflict()
            return tx.marketplaceOrder.create({ data: createData })
          })
        } else {
          order = await db.marketplaceOrder.create({ data: createData })
        }
        break
      } catch (err: unknown) {
        if (err instanceof StockConflict) {
          // Someone else bought the last units mid-checkout — no retry
          return NextResponse.json(
            { error: 'স্টক শেষ হয়ে গেছে — স্টক আপডেট হয়েছে, আবার চেষ্টা করুন', code: 'STOCK_CHANGED' },
            { status: 409 },
          )
        }
        const code = (err as { code?: string })?.code
        if (code === 'P2002' && attempt < 3) {
          const msg = err instanceof Error ? err.message : String(err)
          // unique collision on idempotencyKey (concurrent duplicate)
          if (/idempotencyKey/i.test(msg)) {
            return NextResponse.json(
              { error: 'ডুপ্লিকেট রিকোয়েস্ট — অর্ডার আগেই তৈরি হয়ে গেছে', code: 'REQUEST_ID_TAKEN' },
              { status: 409 },
            )
          }
          // otherwise: orderNumber collision — retry with a fresh number
          continue
        }
        throw err
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'অর্ডার তৈরি করা যায়নি — আবার চেষ্টা করুন' }, { status: 500 })
    }

    // ── Activity history: creation event (Phase 4 — same event log the
    //    status transitions, payment submissions and admin actions use) ──
    await db.marketplaceOrderEvent.create({
      data: {
        orderId: order.id,
        type: 'order_created',
        toStatus: 'pending_payment',
        message: `Direct order placed via checkout — ${qty} × ${product.title}${optionName ? ` (${optionName})` : ''}`,
        actorType: 'user',
        actorId: userId,
      },
    }).catch(() => {})

    // ── Notify the seller (existing notification infra — DB + WS + push) ──
    await notifySellerNewOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      sellerId: product.sellerId,
      totalAmount: order.totalAmount,
      quantity: order.quantity,
      productTitle: product.title,
      isPlatformOwned,
    })

    return NextResponse.json({
      success: true,
      order: serializeOrderLite({ ...order, optionName }),
    })
  } catch (err) {
    console.error('[ORDER CREATE ERROR]', err)
    return NextResponse.json({ error: 'অর্ডার তৈরিতে সমস্যা হয়েছে' }, { status: 500 })
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/orders?role=seller — product orders I SELL.
   Filters: status ('open' | any order status), q (order number /
   product / customer name), from, to (ISO date), sort, page.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get('status')
    const q = searchParams.get('q')?.trim() || ''
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const sort = searchParams.get('sort') || 'newest'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(5, parseInt(searchParams.get('pageSize') || '20', 10) || 20))

    // ── Phase 3: the seller order dashboard is a Verified Business Seller
    // feature — personal digital sellers get an explicit 403 (the UI hides
    // the page for them too; this is the server-side enforcement).
    const caller = await db.user.findUnique({
      where: { id: userId },
      select: { sellerRole: true, sellerDisabled: true },
    })
    if (caller?.sellerDisabled || (caller && caller.sellerRole !== 'business')) {
      return NextResponse.json(
        { error: 'শুধুমাত্র অনুমোদিত ভেরিফায়েড বিজনেস সেলার অর্ডার ড্যাশবোর্ড ব্যবহার করতে পারবেন', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    // Hard scope: MY product orders only (serviceId null + sellerId = me).
    const baseWhere: Record<string, unknown> = {
      sellerId: userId,
      productId: { not: null },
    }

    const where: Record<string, unknown> = { ...baseWhere }
    if (statusParam && statusParam !== 'all') {
      if (statusParam === 'open') {
        where.status = { in: [...OPEN_ORDER_STATUSES] }
      } else if (isOrderStatus(statusParam)) {
        where.status = statusParam
      }
    }

    if (q) {
      where.OR = [
        { orderNumber: { contains: q } },
        { serviceName: { contains: q } },
        { product: { is: { title: { contains: q } } } },
        { user: { is: { name: { contains: q } } } },
      ]
    }

    if (from || to) {
      where.createdAt = {
        ...(from && !Number.isNaN(Date.parse(from)) ? { gte: new Date(from) } : {}),
        ...(to && !Number.isNaN(Date.parse(to)) ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      }
    }

    const orderBy =
      sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : sort === 'amount_desc'
          ? { totalAmount: 'desc' as const }
          : sort === 'amount_asc'
            ? { totalAmount: 'asc' as const }
            : { createdAt: 'desc' as const }

    const [orders, total] = await Promise.all([
      db.marketplaceOrder.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          quantity: true,
          unitPriceAtOrder: true,
          totalAmount: true,
          serviceName: true,
          createdAt: true,
          option: { select: { name: true } },
          product: { select: { id: true, title: true, image: true, category: true, fileKey: true, productType: true } },
          user: { select: { id: true, name: true, imageLink: true } },
        },
      }),
      db.marketplaceOrder.count({ where }),
    ])

    // Summary counts — always computed over the caller's FULL order set
    // (unfiltered) so the cards show true totals, per the spec.
    const group = await db.marketplaceOrder.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    })
    const byStatus = new Map(group.map((g) => [g.status, g._count._all]))
    const counts = {
      total: [...byStatus.values()].reduce((a, b) => a + b, 0),
      pending: OPEN_ORDER_STATUSES.reduce((a, s) => a + (byStatus.get(s) ?? 0), 0),
      processing: FULFILMENT_STATUSES.reduce((a, s) => a + (byStatus.get(s) ?? 0), 0),
      // Phase 5: delivered is a successful terminal-adjacent state —
      // sellers see it in the Completed card (awaiting receipt confirm).
      completed: (byStatus.get('completed') ?? 0) + (byStatus.get('delivered') ?? 0),
      cancelled: byStatus.get('cancelled') ?? 0,
      refunded: byStatus.get('refunded') ?? 0,
    }

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        quantity: o.quantity,
        unitPriceAtOrder: o.unitPriceAtOrder,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        optionName: o.option?.name ?? null,
        // hasFile derived server-side — fileKey itself never leaves the server
        product: {
          id: o.product?.id ?? '',
          title: o.product?.title ?? o.serviceName,
          image: o.product?.image ?? null,
          category: o.product?.category,
          hasFile: !!o.product?.fileKey,
        },
        counterparty: { id: o.user.id, name: o.user.name, imageLink: o.user.imageLink },
      })),
      counts,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
    })
  } catch (err) {
    console.error('[ORDER LIST ERROR]', err)
    return NextResponse.json({ error: 'অর্ডার লোড করা যায়নি' }, { status: 500 })
  }
}

/* ── shared lite serializer (no private buyer data) ── */
function serializeOrderLite(o: {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  quantity: number
  unitPriceAtOrder: number
  totalAmount: number
  serviceName?: string
  optionName?: string | null
  createdAt: Date
}) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    quantity: o.quantity,
    unitPriceAtOrder: o.unitPriceAtOrder,
    totalAmount: o.totalAmount,
    optionName: o.optionName ?? null,
    createdAt: o.createdAt,
  }
}
