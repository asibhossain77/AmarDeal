import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { getSellerBalance } from '@/lib/seller-balance'
import { getLedgerFinancials, round2 } from '@/lib/seller-ledger'

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/analytics — Phase 7 seller dashboard + sales
   analytics. EVERY number is computed SERVER-SIDE from
   authoritative records:

   - Order KPIs (window): MarketplaceOrder rows scoped to THIS seller
     (sellerId = session user). Platform SMM orders (no seller) can
     never leak into a seller's numbers.
   - Money KPIs (window): the seller's itemized ledger — written only
     by verified flows (order completion, verified refund, deal
     completion, admin adjustment). Cancelled/unpaid orders can never
     appear (no ledger entry exists for them); refunds subtract.
   - Balance block: live balance from src/lib/seller-balance.ts
     (available / pending / paid + marketplace-vs-deal breakdown).
   - Series: bucketed day/week/month aggregates for charts.
   - Product-wise + best-selling: completed verified-paid orders only.

   RBAC: active business seller only — a seller can ONLY ever see
   their own analytics; the seller id never comes from the client.
   ═══════════════════════════════════════════════════════════════ */

type Preset = '7d' | '30d' | '12w' | '12m' | 'custom'

interface Bucket {
  start: string
  end: string
  gross: number
  refunds: number
  commission: number
  dealEarnings: number
  adjustments: number
  net: number
  orders: number
}

const DAY_MS = 86_400_000

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Decide bucket size for a custom window. */
function pickBucket(from: Date, to: Date): 'day' | 'week' | 'month' {
  const days = (to.getTime() - from.getTime()) / DAY_MS
  if (days <= 31) return 'day'
  if (days <= 130) return 'week'
  return 'month'
}

function nextBucketStart(d: Date, unit: 'day' | 'week' | 'month'): Date {
  const x = new Date(d)
  if (unit === 'day') { x.setDate(x.getDate() + 1); return x }
  if (unit === 'week') { x.setDate(x.getDate() + 7); return x }
  x.setMonth(x.getMonth() + 1)
  return x
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // ── RBAC: active seller only (matches the seller dashboard gate) ──
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isSeller: true, sellerDisabled: true, isActive: true },
    })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }
    if (!user.isSeller || user.sellerDisabled) {
      return NextResponse.json(
        { error: 'শুধুমাত্র সক্রিয় সেলাররা অ্যানালিটিক্স দেখতে পারবেন', code: 'NOT_SELLER' },
        { status: 403 },
      )
    }

    // ── Window resolution (never trusted from the client beyond params) ──
    const url = new URL(req.url)
    const presetRaw = url.searchParams.get('range') ?? '30d'
    const preset: Preset = (['7d', '30d', '12w', '12m', 'custom'] as const).includes(presetRaw as Preset)
      ? (presetRaw as Preset) : '30d'

    const now = new Date()
    let from: Date
    let to: Date = now
    let unit: 'day' | 'week' | 'month'

    if (preset === 'custom') {
      const f = url.searchParams.get('from')
      const t = url.searchParams.get('to')
      const fD = f ? new Date(f) : null
      const tD = t ? new Date(t) : null
      if (!fD || !tD || Number.isNaN(fD.getTime()) || Number.isNaN(tD.getTime()) || fD > tD) {
        return NextResponse.json({ error: 'সঠিক তারিখ পরিসর দিন', code: 'INVALID_RANGE' }, { status: 400 })
      }
      // Cap custom windows at 2 years to bound the query.
      from = startOfDay(fD)
      to = new Date(startOfDay(tD).getTime() + DAY_MS - 1)
      const maxTo = new Date(from.getTime() + 366 * 2 * DAY_MS)
      if (to > maxTo) to = maxTo
      unit = pickBucket(from, to)
    } else if (preset === '7d') {
      from = startOfDay(new Date(now.getTime() - 6 * DAY_MS)); unit = 'day'
    } else if (preset === '30d') {
      from = startOfDay(new Date(now.getTime() - 29 * DAY_MS)); unit = 'day'
    } else if (preset === '12w') {
      from = startOfDay(new Date(now.getTime() - 83 * DAY_MS)); unit = 'week'
    } else {
      from = new Date(now); from.setMonth(from.getMonth() - 11); from.setDate(1); from.setHours(0, 0, 0, 0)
      unit = 'month'
    }

    // ── Ledger (money truth) + orders in the window ──
    const [ledgerEntries, orders, balance] = await Promise.all([
      db.sellerLedgerEntry.findMany({
        where: { sellerId: userId, createdAt: { gte: from, lte: to } },
        select: { type: true, amount: true, createdAt: true },
      }),
      db.marketplaceOrder.findMany({
        where: { sellerId: userId, createdAt: { gte: from, lte: to } },
        select: {
          id: true, orderNumber: true, serviceName: true, status: true,
          paymentStatus: true, totalAmount: true, quantity: true,
          productId: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      getSellerBalance(userId),
    ])

    // Money KPIs from the ledger within the window
    const fin = await getLedgerFinancials(userId, { from, to })

    // ── Order KPIs (window, this seller only) ──
    const terminalCancelled = new Set(['cancelled', 'refunded'])
    const openDisputeOrders = await db.orderDispute.findMany({
      where: { order: { sellerId: userId }, status: { in: ['open', 'under_review'] } },
      select: { orderId: true },
    })
    const disputeOrderIds = new Set(openDisputeOrders.map((d) => d.orderId))

    const orderKpis = {
      total: orders.length,
      completed: orders.filter((o) => o.status === 'completed').length,
      pending: orders.filter((o) => !terminalCancelled.has(o.status) && o.status !== 'completed').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      refunded: orders.filter((o) => o.status === 'refunded').length,
      disputed: new Set([
        ...orders.filter((o) => o.status === 'disputed').map((o) => o.id),
        ...orders.filter((o) => disputeOrderIds.has(o.id)).map((o) => o.id),
      ]).size,
    }

    // ── Series buckets ──
    const buckets: Bucket[] = []
    let cursor = startOfDay(from)
    while (cursor <= to) {
      const bucketEnd = new Date(Math.min(nextBucketStart(cursor, unit).getTime() - 1, to.getTime()))
      buckets.push({
        start: cursor.toISOString(), end: bucketEnd.toISOString(),
        gross: 0, refunds: 0, commission: 0, dealEarnings: 0, adjustments: 0, net: 0, orders: 0,
      })
      cursor = nextBucketStart(cursor, unit)
    }
    const bucketFor = (d: Date): Bucket | null => {
      const t = d.getTime()
      for (const b of buckets) {
        if (t >= Date.parse(b.start) && t <= Date.parse(b.end)) return b
      }
      return null
    }
    for (const e of ledgerEntries) {
      const b = bucketFor(e.createdAt)
      if (!b) continue
      if (e.type === 'sale') b.gross = round2(b.gross + e.amount)
      else if (e.type === 'refund') b.refunds = round2(b.refunds + Math.abs(e.amount))
      else if (e.type === 'commission') b.commission = round2(b.commission + Math.abs(e.amount))
      else if (e.type === 'commission_reversal') b.commission = round2(b.commission - e.amount)
      else if (e.type === 'deal_earning') b.dealEarnings = round2(b.dealEarnings + e.amount)
      else if (e.type === 'adjustment') b.adjustments = round2(b.adjustments + e.amount)
    }
    for (const o of orders) {
      const b = bucketFor(o.createdAt)
      if (b) b.orders += 1
    }
    for (const b of buckets) {
      b.net = round2(b.gross - b.refunds - b.commission + b.dealEarnings + b.adjustments)
    }

    // ── Product-wise + best sellers (completed verified-paid only —
    //    exactly the orders whose completion produced a sale entry) ──
    const byProduct = new Map<string, { productId: string; title: string; orders: number; units: number; gross: number }>()
    for (const o of orders) {
      if (o.status !== 'completed' || o.paymentStatus !== 'paid' || !o.productId) continue
      const key = o.productId
      const cur = byProduct.get(key) ?? {
        productId: key, title: o.serviceName, orders: 0, units: 0, gross: 0,
      }
      cur.orders += 1
      cur.units += o.quantity
      cur.gross = round2(cur.gross + o.totalAmount)
      byProduct.set(key, cur)
    }
    const products = [...byProduct.values()].sort((a, b) => b.gross - a.gross).slice(0, 6)

    // ── Recent orders (any status) ──
    const recentOrders = orders.slice(0, 8).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.serviceName,
      amount: o.totalAmount,
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
    }))

    // ── Pending actions (this seller's own items only) ──
    const [toStart, toFulfil, pendingCancellations] = await Promise.all([
      db.marketplaceOrder.count({ where: { sellerId: userId, status: 'queued', paymentStatus: 'paid' } }),
      db.marketplaceOrder.count({ where: { sellerId: userId, status: 'processing', paymentStatus: 'paid' } }),
      db.orderCancellationRequest.count({
        where: { status: 'pending', order: { sellerId: userId } },
      }),
    ])
    const pendingActions = {
      toStart,
      toFulfil,
      openDisputes: disputeOrderIds.size,
      pendingCancellations,
      // Actionable items the seller should look at first
      items: orders
        .filter((o) => (['queued', 'processing'].includes(o.status) && o.paymentStatus === 'paid') || o.status === 'disputed' || disputeOrderIds.has(o.id))
        .slice(0, 5)
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          title: o.serviceName,
          status: o.status,
          action: o.status === 'queued'
            ? 'start'
            : o.status === 'processing'
              ? 'fulfil'
              : 'dispute',
        })),
    }

    return NextResponse.json({
      range: { preset, from, to, unit },
      orders: orderKpis,
      money: {
        grossSales: fin.grossSales,
        refunds: fin.refunds,
        commission: fin.commission,
        marketplaceNet: fin.marketplaceNet,
        dealEarnings: fin.dealEarnings,
        adjustments: fin.adjustments,
        totalNet: fin.totalNet,
      },
      balance,
      series: buckets,
      products,
      recentOrders,
      pendingActions,
    })
  } catch (err) {
    console.error('[SELLER ANALYTICS ERROR]', err)
    return NextResponse.json({ error: 'অ্যানালিটিক্স লোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
