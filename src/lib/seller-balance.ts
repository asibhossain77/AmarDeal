import { db } from '@/lib/db'

/**
 * Seller balance — computed live from the DB, never stored.
 *
 *   available = Σ completed deal amounts (seller's full earning — the platform
 *               fee is charged to the buyer on top, so nothing is deducted)
 *             − Σ legacy per-deal seller_payouts (Payout rows for the seller's
 *               CURRENT completed deals, excluding rejected)
 *             − Σ SellerWithdrawal amounts with status pending/approved/completed
 *
 * Only payouts tied to the seller's still-existing completed deals are counted,
 * so orphaned Payout rows (their deals were deleted) can never reduce a balance.
 */
export interface SellerBalance {
  /** Σ Deal.amount for the seller's completed deals */
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
}

export async function getSellerBalance(sellerId: string): Promise<SellerBalance> {
  const completedDeals = await db.deal.findMany({
    where: { sellerId, status: 'completed' },
    select: { id: true, amount: true },
  })
  const completedIds = completedDeals.map((d) => d.id)
  const totalEarnings = completedDeals.reduce((sum, d) => sum + d.amount, 0)

  const [legacyAgg, wdPaidAgg, wdPendingAgg] = await Promise.all([
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
  ])

  const legacyPayouts = legacyAgg._sum.amount ?? 0
  const withdrawnPaid = wdPaidAgg._sum.amount ?? 0
  const pendingWithdrawals = wdPendingAgg._sum.amount ?? 0
  const available = Math.max(0, totalEarnings - legacyPayouts - withdrawnPaid - pendingWithdrawals)

  return {
    totalEarnings,
    legacyPayouts,
    withdrawnPaid,
    pendingWithdrawals,
    available,
    completedDeals: completedDeals.length,
  }
}
