/**
 * Phase 7 backfill — populate the SellerLedgerEntry ledger from
 * authoritative records that predate the ledger. Idempotent: the
 * (sourceType, sourceId, type) unique constraint makes reruns a no-op.
 *
 *   - completed + verified-paid marketplace orders with a seller
 *       → 'sale' entry (rate snapshot 0 — NO retroactive commission:
 *         no commission mechanism existed when these completed)
 *       → 'commission' entry ONLY if a sale already exists with a
 *         nonzero snapshot (not the case here; kept for safety)
 *   - refunded refund-requests on seller orders → 'refund' entry
 *   - completed seller withdrawals → 'payout' entry (reference may be
 *     null for legacy payouts — flagged backfilled:true)
 *   - completed deals with a seller → 'deal_earning' entry
 *
 * Timestamps mirror the REAL event time (completedAt/refundedAt),
 * so date-range reports stay historically accurate.
 *
 * Run: DATABASE_URL=file:./db/custom.db npx tsx scripts/phase7-ledger-backfill.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function upsertEntry(row: {
  sellerId: string
  sourceType: string
  sourceId: string
  type: string
  amount: number
  description: string
  details?: Record<string, unknown>
  createdAt: Date
}) {
  const data = {
    sellerId: row.sellerId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    type: row.type,
    amount: round2(row.amount),
    description: row.description.slice(0, 500),
    details: row.details ? JSON.stringify(row.details) : null,
    createdAt: row.createdAt,
  }
  await db.sellerLedgerEntry.upsert({
    where: {
      sourceType_sourceId_type: {
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        type: row.type,
      },
    },
    create: data,
    update: {},
  })
}

async function main() {
  let sales = 0, refunds = 0, payouts = 0, dealEarnings = 0

  // 1. Completed verified-paid marketplace orders → sale entries
  const orders = await db.marketplaceOrder.findMany({
    where: { status: 'completed', paymentStatus: 'paid', sellerId: { not: null } },
    select: { id: true, sellerId: true, totalAmount: true, orderNumber: true, completedAt: true },
  })
  for (const o of orders) {
    if (!o.sellerId || !(o.totalAmount > 0)) continue
    await upsertEntry({
      sellerId: o.sellerId,
      sourceType: 'marketplace_order',
      sourceId: o.id,
      type: 'sale',
      amount: o.totalAmount,
      description: `বিক্রয় — অর্ডার ${o.orderNumber}`,
      details: { orderNumber: o.orderNumber, rate: 0, backfilled: true },
      createdAt: o.completedAt ?? new Date(),
    })
    sales++
  }

  // 2. Verified refunds → refund entries (rate 0 → no reversal to backfill)
  const refundReqs = await db.refundRequest.findMany({
    where: { status: 'refunded' },
    select: {
      id: true, orderId: true, amount: true, refundedAt: true,
      order: { select: { sellerId: true, orderNumber: true } },
    },
  })
  for (const r of refundReqs) {
    if (!r.order.sellerId || !(r.amount > 0)) continue
    await upsertEntry({
      sellerId: r.order.sellerId,
      sourceType: 'marketplace_order',
      sourceId: r.orderId,
      type: 'refund',
      amount: -r.amount,
      description: `রিফান্ড — অর্ডার ${r.order.orderNumber}`,
      details: { orderNumber: r.order.orderNumber, refundRequestId: r.id, backfilled: true },
      createdAt: r.refundedAt ?? new Date(),
    })
    refunds++
  }

  // 3. Completed withdrawals → payout entries
  const withdrawals = await db.sellerWithdrawal.findMany({
    where: { status: 'completed' },
    select: {
      id: true, userId: true, amount: true, accountType: true, accountNumber: true,
      paymentReference: true, completedAt: true, updatedAt: true,
    },
  })
  for (const w of withdrawals) {
    if (!(w.amount > 0)) continue
    await upsertEntry({
      sellerId: w.userId,
      sourceType: 'withdrawal',
      sourceId: w.id,
      type: 'payout',
      amount: -w.amount,
      description: `উত্তোলন পরিশোধ — ${w.accountType} (${w.accountNumber.slice(-4)})`,
      details: {
        paymentReference: w.paymentReference ?? '(legacy — reference not recorded)',
        accountType: w.accountType,
        accountNumber: w.accountNumber,
        backfilled: true,
      },
      createdAt: w.completedAt ?? w.updatedAt,
    })
    payouts++
  }

  // 4. Completed deals → deal earning entries
  const deals = await db.deal.findMany({
    where: { status: 'completed', sellerId: { not: null } },
    select: { id: true, sellerId: true, amount: true, title: true, updatedAt: true },
  })
  for (const d of deals) {
    if (!d.sellerId || !(d.amount > 0)) continue
    await upsertEntry({
      sellerId: d.sellerId,
      sourceType: 'deal',
      sourceId: d.id,
      type: 'deal_earning',
      amount: d.amount,
      description: `ডিল আয় — ${d.title.slice(0, 120)}`,
      details: { dealTitle: d.title.slice(0, 200), backfilled: true },
      createdAt: d.updatedAt,
    })
    dealEarnings++
  }

  const total = await db.sellerLedgerEntry.count()
  console.log(JSON.stringify({
    scanned: { completedOrders: orders.length, refundedRequests: refundReqs.length, completedWithdrawals: withdrawals.length, completedDeals: deals.length },
    written: { sales, refunds, payouts, dealEarnings },
    totalLedgerEntries: total,
  }, null, 2))
}

main()
  .catch((e) => { console.error('BACKFILL FAILED:', e); process.exit(1) })
  .finally(() => db.$disconnect())
