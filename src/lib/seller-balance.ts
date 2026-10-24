import { db } from '@/lib/db'
import { getLedgerFinancials } from '@/lib/seller-ledger'

/**
 * Seller balance — computed live from authoritative records, never stored.
 *
 *   Phase 7: earnings now span BOTH systems, kept distinguishable:
 *
 *   dealEarnings      = Σ completed Deal amounts (seller's full earning — the
 *                       platform fee is charged to the buyer on top, nothing
 *                       deducted) — unchanged legacy math
 *   marketplaceNet    = ledger-derived: Σ sale − Σ refund − commission(net)
 *                       for the seller's completed marketplace orders only
 *                       (commission % snapshotted per order at completion)
 *   adjustments       = admin manual ± ledger corrections (audited)
 *
 *   available = max(0,
 *     dealEarnings + marketplaceNet + adjustments
 *     − Σ legacy per-deal seller_payouts (Payout rows for the seller's
 *       CURRENT completed deals, excluding rejected)
 *     − Σ SellerWithdrawal amounts with status pending/approved/completed)
 *
 * Only payouts tied to the seller's still-existing completed deals are counted,
 * so orphaned Payout rows (their deals were deleted) can never reduce a balance.
 */
export interface SellerBalance {
  /** Σ Deal.amount for the seller's completed deals (legacy pool) */
  totalEarnings: number
  /** Σ legacy per-deal seller_payout amounts (current completed deals only) */
  legacyPayouts: number
  /** Σ completed (paid) SellerWithdrawal amounts */
  withdrawnPaid: number
  /** Σ pending + approved SellerWithdrawal amounts (locked, awaiting admin) */
  pendingWithdrawals: number
  /** What the seller can request right now */
  available: number
  /** Number of completed deals contributing to the balance */
  completedDeals: number
  // ── Phase 7: marketplace vs deal breakdown (distinguishable) ──
  /** Σ marketplace gross sales (verified-paid completed orders) */
  marketplaceGross: number
  /** Σ verified refunds against marketplace orders */
  marketplaceRefunds: number
  /** Σ platform commission charged on marketplace orders (net of reversals) */
  marketplaceCommission: number
  /** marketplace gross − refunds − commission */
  marketplaceNet: number
  /** Σ admin financial adjustments (±, audited) */
  adjustments: number
  /** dealEarnings + marketplaceNet + adjustments */
  totalNetEarnings: number
}

export async function getSellerBalance(sellerId: string): Promise<SellerBalance> {
  const completedDeals = await db.deal.findMany({
    where: { sellerId, status: 'completed' },
    select: { id: true, amount: true },
  })
  const completedIds = completedDeals.map((d) => d.id)
  const dealEarnings = completedDeals.reduce((sum, d) => sum + d.amount, 0)

  const [legacyAgg, wdPaidAgg, wdPendingAgg, ledger] = await Promise.all([
    completedIds.length
      ? db.payout.aggregate({
          where: { dealId: { in: completedIds }, type: 'seller_payout', status: { not: 'rejected' } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null as number | null } }),
    db.sellerWithdrawal.aggregate({
      where: { userId: sellerId, status: 'completed' },
      _sum: { amount: true },
    }),
    db.sellerWithdrawal.aggregate({
      where: { userId: sellerId, status: { in: ['pending', 'approved'] } },
      _sum: { amount: true },
    }),
    // Phase 7: marketplace sale/refund/commission + adjustments + paid
    // payouts — all from the itemized ledger (authoritative, idempotent).
    getLedgerFinancials(sellerId),
  ])

  const legacyPayouts = legacyAgg._sum.amount ?? 0
  const withdrawnPaid = wdPaidAgg._sum.amount ?? 0
  const pendingWithdrawals = wdPendingAgg._sum.amount ?? 0

  // Marketplace net + adjustments come from the ledger; deal earnings stay
  // on the legacy Deal-table math (never rewrites existing seller balances).
  const marketplaceNet = ledger.marketplaceNet
  const adjustments = ledger.adjustments
  const totalNetEarnings = Math.round((dealEarnings + marketplaceNet + adjustments) * 100) / 100
  const available = Math.max(0, Math.round((totalNetEarnings - legacyPayouts - withdrawnPaid - pendingWithdrawals) * 100) / 100)

  return {
    totalEarnings: dealEarnings,
    legacyPayouts,
    withdrawnPaid,
    pendingWithdrawals,
    available,
    completedDeals: completedDeals.length,
    marketplaceGross: ledger.grossSales,
    marketplaceRefunds: ledger.refunds,
    marketplaceCommission: ledger.commission,
    marketplaceNet,
    adjustments,
    totalNetEarnings,
  }
}
