import { db } from '@/lib/db'

/**
 * Shared fee calculation — single source of truth for the platform fee.
 *
 * Priority:
 * 1. Fee-free threshold — deal amount <= 'fee_free_below'  ->  fee = 0
 * 2. Active tiered FeeRule covering the amount             ->  fixed rule fee
 * 3. Fallback percentage on the deal amount                ->  amount * 'fee_percentage' / 100
 *
 * Both 'fee_free_below' and 'fee_percentage' are PlatformSetting keys,
 * editable from the admin Website Settings panel.
 */

/** Fallback fee percentage applied when no fee rule matches (editable via PlatformSetting 'fee_percentage') */
export const DEFAULT_FEE_PERCENTAGE = 3

/** Deals with amount <= this threshold are fee-free (editable via PlatformSetting 'fee_free_below') */
export const DEFAULT_FEE_FREE_BELOW = 50

export interface FeeConfig {
  /** Fallback fee percentage applied when no tier rule matches */
  feePercentage: number
  /** Deals with amount <= freeBelow are fee-free */
  freeBelow: number
}

export interface FeeResult {
  /** Final platform fee in BDT */
  fee: number
  /** The tier rule that matched, if any */
  matchedRule: {
    minimum_amount: number
    maximum_amount: number
    fee: number
  } | null
  /** How the fee was determined: 'free' (under threshold), 'rule' (tier rule), 'percentage' (fallback %) */
  source: 'free' | 'rule' | 'percentage'
  /** The active fee configuration used */
  config: FeeConfig
}

/**
 * Load fee configuration from PlatformSetting with safe fallbacks.
 * Invalid or missing values fall back to the defaults above.
 */
export async function getFeeConfig(): Promise<FeeConfig> {
  const settings = await db.platformSetting.findMany({
    where: { key: { in: ['fee_percentage', 'fee_free_below'] } },
  })

  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value

  const pct = parseFloat(map.fee_percentage ?? '')
  const free = parseFloat(map.fee_free_below ?? '')

  return {
    feePercentage:
      !isNaN(pct) && pct >= 0 && pct <= 100 ? pct : DEFAULT_FEE_PERCENTAGE,
    freeBelow: !isNaN(free) && free >= 0 ? free : DEFAULT_FEE_FREE_BELOW,
  }
}

/**
 * Calculate the platform fee for a deal amount.
 * Used by /api/deals/calculate-fee, /api/deals/payment and
 * /api/admin/deals/[id]/update-payment-amount so every path stays consistent.
 */
export async function calculateDealFee(amount: number): Promise<FeeResult> {
  const config = await getFeeConfig()

  // 1. Fee-free threshold — small deals are free
  if (amount <= config.freeBelow) {
    return { fee: 0, matchedRule: null, source: 'free', config }
  }

  // 2. Tiered fixed-fee rules
  const rules = await db.feeRule.findMany({
    where: { is_active: true },
    orderBy: { minimum_amount: 'asc' },
  })
  for (const rule of rules) {
    if (amount >= rule.minimum_amount) {
      if (rule.maximum_amount === 0 || amount <= rule.maximum_amount) {
        return {
          fee: rule.fee,
          matchedRule: {
            minimum_amount: rule.minimum_amount,
            maximum_amount: rule.maximum_amount,
            fee: rule.fee,
          },
          source: 'rule',
          config,
        }
      }
    }
  }

  // 3. Percentage fallback on the deal amount (rounded to 2 decimal places)
  const fee = Math.round(amount * config.feePercentage) / 100
  return { fee, matchedRule: null, source: 'percentage', config }
}
