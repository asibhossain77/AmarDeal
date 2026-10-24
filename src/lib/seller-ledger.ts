import { db } from '@/lib/db'

/* ═══════════════════════════════════════════════════════════════
   Phase 7 — Seller financial ledger (server-side ONLY).

   The SellerLedgerEntry table is the itemized, append-only money
   trail for every seller. Entries are written ONLY here, ONLY at
   the moment authoritative state changes (order completed, refund
   verified, payout completed, deal completed, admin adjustment):

     marketplace_order  sale (+gross) · commission (−gross×rate)
                        refund (−refunded) · commission_reversal
                        (+refunded×rate) — all referenced by order id
     deal               deal_earning (+deal.amount) — Admin Deal
                        earnings, always distinguishable from
                        marketplace earnings
     withdrawal         payout (−withdrawal.amount) — written when
                        an admin completes a payout WITH verified
                        payment reference
     adjustment         admin manual ± correction (audited)

   Invariants enforced here:
   - Every write is idempotent: @@unique([sourceType, sourceId, type])
     means a retried/replayed flow can never duplicate money rows.
   - Commission % is snapshotted into `details` at write time — later
     rate changes NEVER rewrite history; refunds reverse commission
     at the SAME snapshot rate.
   - A sale entry is only ever written for a VERIFIED-PAID order
     (paymentStatus 'paid' / paidAt set). Unpaid/cancelled orders
     can never produce earnings.
   - Writes never break the calling flow: a ledger failure is logged
     loudly but cannot roll back an order/refund/payout.

   All money math uses poisha-safe rounding (×100 → round → ÷100),
   matching src/lib/marketplace-pricing.ts.
   ═══════════════════════════════════════════════════════════════ */

export const MARKETPLACE_COMMISSION_KEY = 'marketplace_commission_percent'

/** Ledger entry types (mirrors schema comment). */
export const LEDGER_ENTRY_TYPES = [
  'sale', 'commission', 'refund', 'commission_reversal',
  'deal_earning', 'payout', 'adjustment',
] as const
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number]

/** Poisha-safe rounding — 1 BDT = 100 poisha. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/* ── Commission rate (PlatformSetting — never hardcoded) ──────── */

/**
 * Current marketplace commission rate in percent (0–100).
 * Reads the admin-configurable PlatformSetting; when unset or
 * invalid the platform charges NOTHING (0) — a business rate is
 * never invented by code.
 */
export async function getCommissionPercent(): Promise<number> {
  try {
    const row = await db.platformSetting.findUnique({
      where: { key: MARKETPLACE_COMMISSION_KEY },
    })
    if (!row) return 0
    const v = Number(row.value)
    if (!Number.isFinite(v) || v <= 0) return 0
    return Math.min(100, v)
  } catch {
    return 0
  }
}

/** Commission amount for a gross value at a snapshot rate (poisha-safe). */
export function commissionOn(gross: number, ratePercent: number): number {
  if (!(ratePercent > 0) || !(gross > 0)) return 0
  return round2((gross * ratePercent) / 100)
}

/* ── Core idempotent writer ───────────────────────────────────── */

export interface LedgerWriteInput {
  sellerId: string
  sourceType: 'marketplace_order' | 'deal' | 'withdrawal' | 'adjustment'
  sourceId: string
  type: LedgerEntryType
  amount: number
  description: string
  details?: Record<string, unknown>
  /** Force a specific timestamp (backfill) — defaults to now. */
  createdAt?: Date
}

/**
 * Write one ledger entry. Idempotent on (sourceType, sourceId, type):
 * replaying the same financial event is a no-op. Never throws — a
 * ledger problem must not break the order/refund/payout flow.
 */
export async function writeLedgerEntry(input: LedgerWriteInput): Promise<void> {
  try {
    const data = {
      sellerId: input.sellerId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      type: input.type,
      amount: round2(input.amount),
      description: input.description.slice(0, 500),
      details: input.details ? JSON.stringify(input.details) : null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    }
    await db.sellerLedgerEntry.upsert({
      where: {
        sourceType_sourceId_type: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          type: input.type,
        },
      },
      create: data,
      // Replay of an already-recorded event — keep the original row
      // (original amount + timestamp) untouched.
      update: {},
    })
  } catch (err) {
    console.error('[seller-ledger] WRITE FAILED', input.sourceType, input.sourceId, input.type, err)
  }
}

/* ── Marketplace order events ─────────────────────────────────── */

export interface MarketplaceSaleInput {
  orderId: string
  sellerId: string
  totalAmount: number
  orderNumber: string
  paymentStatus?: string
  paidAt?: Date | null
}

/**
 * Order reached 'completed': record the seller's gross sale and the
 * platform commission at the CURRENT rate (snapshotted). Only
 * verified-paid orders can produce a sale — this is re-checked here
 * even though transitions already enforce it.
 */
export async function recordMarketplaceSale(input: MarketplaceSaleInput): Promise<void> {
  try {
    const paid = input.paymentStatus === 'paid' || !!input.paidAt
    if (!paid) {
      console.error('[seller-ledger] refusing sale entry for non-paid order', input.orderNumber)
      return
    }
    if (!input.sellerId || !(input.totalAmount > 0)) return

    const rate = await getCommissionPercent()
    const common = { orderNumber: input.orderNumber, rate }

    await writeLedgerEntry({
      sellerId: input.sellerId,
      sourceType: 'marketplace_order',
      sourceId: input.orderId,
      type: 'sale',
      amount: input.totalAmount,
      description: `বিক্রয় — অর্ডার ${input.orderNumber}`,
      details: common,
    })

    const commission = commissionOn(input.totalAmount, rate)
    if (commission > 0) {
      await writeLedgerEntry({
        sellerId: input.sellerId,
        sourceType: 'marketplace_order',
        sourceId: input.orderId,
        type: 'commission',
        amount: -commission,
        description: `প্ল্যাটফর্ম কমিশন (${rate}%) — অর্ডার ${input.orderNumber}`,
        details: common,
      })
    }
  } catch (err) {
    console.error('[seller-ledger] recordMarketplaceSale failed', input.orderNumber, err)
  }
}

export interface MarketplaceRefundInput {
  orderId: string
  sellerId: string
  refundAmount: number
  orderNumber: string
  refundRequestId: string
}

/**
 * Admin verified a REAL refund (reference + proof recorded): debit the
 * seller for the refunded amount and reverse the commission taken on
 * that portion — at the SAME rate snapshotted when the sale posted.
 * If no commission was charged at completion, there is nothing to
 * reverse (rate 0 → no reversal entry).
 */
export async function recordMarketplaceRefund(input: MarketplaceRefundInput): Promise<void> {
  try {
    if (!input.sellerId || !(input.refundAmount > 0)) return

    // Rate snapshot from the original sale/commission entry — falls
    // back to 0 (never re-charges or re-reverses at today's rate).
    let rate = 0
    const commissionEntry = await db.sellerLedgerEntry.findUnique({
      where: {
        sourceType_sourceId_type: {
          sourceType: 'marketplace_order',
          sourceId: input.orderId,
          type: 'commission',
        },
      },
      select: { details: true },
    })
    if (commissionEntry?.details) {
      try {
        const parsed = JSON.parse(commissionEntry.details) as { rate?: number }
        if (typeof parsed.rate === 'number' && parsed.rate >= 0) rate = parsed.rate
      } catch { /* corrupt details → treat as 0 */ }
    }

    await writeLedgerEntry({
      sellerId: input.sellerId,
      sourceType: 'marketplace_order',
      sourceId: input.orderId,
      type: 'refund',
      amount: -input.refundAmount,
      description: `রিফান্ড — অর্ডার ${input.orderNumber}`,
      details: { orderNumber: input.orderNumber, refundRequestId: input.refundRequestId },
    })

    const reversal = commissionOn(input.refundAmount, rate)
    if (reversal > 0) {
      await writeLedgerEntry({
        sellerId: input.sellerId,
        sourceType: 'marketplace_order',
        sourceId: input.orderId,
        type: 'commission_reversal',
        amount: reversal,
        description: `কমিশন ফেরত (${rate}%) — অর্ডার ${input.orderNumber} রিফান্ড`,
        details: { orderNumber: input.orderNumber, rate, refundRequestId: input.refundRequestId },
      })
    }
  } catch (err) {
    console.error('[seller-ledger] recordMarketplaceRefund failed', input.orderNumber, err)
  }
}

/* ── Admin Deal earnings (kept distinguishable) ───────────────── */

export interface DealEarningInput {
  dealId: string
  sellerId: string
  amount: number
  dealTitle: string
}

/**
 * A Deal (escrow) completed → seller earning entry. The platform fee
 * on deals is charged to the BUYER on top, so the seller's earning is
 * the full deal amount (same rule as the existing balance math).
 */
export async function recordDealEarning(input: DealEarningInput): Promise<void> {
  try {
    if (!input.sellerId || !(input.amount > 0)) return
    await writeLedgerEntry({
      sellerId: input.sellerId,
      sourceType: 'deal',
      sourceId: input.dealId,
      type: 'deal_earning',
      amount: input.amount,
      description: `ডিল আয় — ${input.dealTitle.slice(0, 120)}`,
      details: { dealTitle: input.dealTitle.slice(0, 200) },
    })
  } catch (err) {
    console.error('[seller-ledger] recordDealEarning failed', input.dealId, err)
  }
}

/* ── Payouts ──────────────────────────────────────────────────── */

export interface PayoutInput {
  withdrawalId: string
  sellerId: string
  amount: number
  paymentReference: string
  accountType: string
  accountNumber: string
}

/**
 * Admin completed a payout with verified payment evidence → debit
 * entry referencing the actual payment (TxnID). Called only from the
 * admin completion route AFTER the reference check — never before.
 */
export async function recordPayout(input: PayoutInput): Promise<void> {
  try {
    if (!input.sellerId || !(input.amount > 0)) return
    await writeLedgerEntry({
      sellerId: input.sellerId,
      sourceType: 'withdrawal',
      sourceId: input.withdrawalId,
      type: 'payout',
      amount: -input.amount,
      description: `উত্তোলন পরিশোধ — ${input.accountType} (${input.accountNumber.slice(-4)})`,
      details: {
        paymentReference: input.paymentReference,
        accountType: input.accountType,
        accountNumber: input.accountNumber,
      },
    })
  } catch (err) {
    console.error('[seller-ledger] recordPayout failed', input.withdrawalId, err)
  }
}

/* ── Admin adjustments ────────────────────────────────────────── */

export interface AdjustmentInput {
  sellerId: string
  /** Signed: + credit to seller, − debit. Must be non-zero. */
  amount: number
  reason: string
  adminId: string
  adminName: string
}

/**
 * Manual financial adjustment by an authorized admin (+/−). The id is
 * generated up-front so it can serve as its own transaction reference.
 * Idempotent per adjustment row — callers must create a NEW entry for
 * a further correction (never replay an old one).
 */
export async function recordAdjustment(input: AdjustmentInput): Promise<{ id: string } | null> {
  try {
    const amount = round2(input.amount)
    if (!Number.isFinite(amount) || amount === 0) return null
    const roundedReason = input.reason.trim().slice(0, 500)
    if (!roundedReason) return null

    const id = (() => {
      // cuid-like unique reference without extra deps
      return 'adj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    })()

    await writeLedgerEntry({
      sellerId: input.sellerId,
      sourceType: 'adjustment',
      sourceId: id,
      type: 'adjustment',
      amount,
      description: `অ্যাডমিন সমন্বয় — ${roundedReason.slice(0, 120)}`,
      details: { reason: roundedReason, adminId: input.adminId, adminName: input.adminName, adjustmentRef: id },
    })
    return { id }
  } catch (err) {
    console.error('[seller-ledger] recordAdjustment failed', err)
    return null
  }
}

/* ── Aggregation helpers (analytics + balance) ────────────────── */

export interface LedgerFinancials {
  grossSales: number
  refunds: number
  commission: number      // net commission charged (commission − reversal)
  dealEarnings: number
  adjustments: number
  payoutsPaid: number     // Σ completed payout entries (negative amounts → positive number)
  marketplaceNet: number
  totalNet: number
}

function emptyFinancials(): LedgerFinancials {
  return {
    grossSales: 0, refunds: 0, commission: 0, dealEarnings: 0,
    adjustments: 0, payoutsPaid: 0, marketplaceNet: 0, totalNet: 0,
  }
}

/** Sum per type from grouped ledger rows. */
function sumsFromGroups(
  groups: { type: string; _sum: { amount: number | null } }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const g of groups) out[g.type] = round2(g._sum.amount ?? 0)
  return out
}

/**
 * Seller financial aggregates from the LEDGER (authoritative itemized
 * record — written only by verified flows). Optional window [from, to].
 */
export async function getLedgerFinancials(
  sellerId: string,
  window?: { from?: Date; to?: Date },
): Promise<LedgerFinancials> {
  const base = emptyFinancials()
  try {
    const groups = await db.sellerLedgerEntry.groupBy({
      by: ['type'],
      where: {
        sellerId,
        ...(window?.from || window?.to
          ? { createdAt: { ...(window.from ? { gte: window.from } : {}), ...(window.to ? { lte: window.to } : {}) } }
          : {}),
      },
      _sum: { amount: true },
    })
    const s = sumsFromGroups(groups)
    const gross = s.sale ?? 0
    const refunds = Math.abs(s.refund ?? 0)
    const commissionGross = Math.abs(s.commission ?? 0)
    const commissionReversal = s.commission_reversal ?? 0
    const dealEarnings = s.deal_earning ?? 0
    const adjustments = s.adjustment ?? 0
    const payoutsPaid = Math.abs(s.payout ?? 0)

    const commissionNet = round2(commissionGross - commissionReversal)
    const marketplaceNet = round2(gross - refunds - commissionNet)
    const totalNet = round2(marketplaceNet + dealEarnings + adjustments)

    return {
      grossSales: gross,
      refunds,
      commission: commissionNet,
      dealEarnings,
      adjustments,
      payoutsPaid,
      marketplaceNet,
      totalNet,
    }
  } catch (err) {
    console.error('[seller-ledger] getLedgerFinancials failed', sellerId, err)
    return base
  }
}
