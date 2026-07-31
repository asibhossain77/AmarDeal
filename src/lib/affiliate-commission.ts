import { db } from '@/lib/db'

/**
 * Processes affiliate commission when a deal is completed.
 *
 * Rules:
 * 1. Only fires on 'completed' deal status
 * 2. Max 1 commission per deal (Buyer affiliate > Seller affiliate priority)
 * 3. Commission = platformFee × commissionPercentage / 100
 * 4. Commission % defaults to 30%, configurable via PlatformSetting 'affiliate_commission_percent'
 * 5. Idempotent — safe to call multiple times for the same deal
 */
export async function processAffiliateCommission(dealId: string): Promise<void> {
  try {
    // 1. Skip if commission already processed for this deal
    const existingEarning = await db.affiliateEarning.findUnique({
      where: { dealId },
    })
    if (existingEarning) return

    // 2. Fetch deal with buyer/seller referral info
    const deal = await db.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        status: true,
        platformFee: true,
        buyerId: true,
        sellerId: true,
        buyer: {
          select: { id: true, referredBy: true },
        },
        seller: {
          select: { id: true, referredBy: true },
        },
      },
    })
    if (!deal || deal.status !== 'completed') return

    // 3. Determine which user was referred (Buyer priority > Seller)
    let affiliateId: string | undefined
    let referredUserId: string | undefined

    if (deal.buyer?.referredBy) {
      affiliateId = deal.buyer.referredBy
      referredUserId = deal.buyer.id
    } else if (deal.seller?.referredBy) {
      affiliateId = deal.seller.referredBy
      referredUserId = deal.seller.id
    }

    if (!affiliateId || !referredUserId) return

    // 4. Verify affiliate user exists and is active
    const affiliate = await db.user.findUnique({
      where: { id: affiliateId },
      select: { id: true, isActive: true },
    })
    if (!affiliate?.isActive) return

    // 5. Don't give commission if affiliate is dealing with themselves
    if (affiliateId === referredUserId) return

    // 6. Get commission percentage from settings (default 30%)
    let commissionPercent = 30
    try {
      const setting = await db.platformSetting.findUnique({
        where: { key: 'affiliate_commission_percent' },
      })
      if (setting?.value) {
        const parsed = parseFloat(setting.value)
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
          commissionPercent = parsed
        }
      }
    } catch {
      // Use default 30%
    }

    // 7. Calculate commission amount
    const platformFee = deal.platformFee ?? 0
    const commissionAmount = Math.round((platformFee * commissionPercent) / 100 * 100) / 100

    if (commissionAmount <= 0) return

    // 8. Create AffiliateEarning record + update balance in a transaction
    await db.$transaction([
      db.affiliateEarning.create({
        data: {
          affiliateId,
          dealId: deal.id,
          referredUserId,
          amount: commissionAmount,
          percentage: commissionPercent,
          status: 'pending',
        },
      }),
      db.user.update({
        where: { id: affiliateId },
        data: {
          affiliateBalance: {
            increment: commissionAmount,
          },
        },
      }),
    ])

    console.log(
      `[AFFILIATE] Commission ${commissionAmount} BDT (${commissionPercent}%) credited to ${affiliateId} for deal ${dealId}`
    )
  } catch (err) {
    console.error('[AFFILIATE COMMISSION ERROR]', err)
  }
}
