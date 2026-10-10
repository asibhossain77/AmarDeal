import { db } from '@/lib/db'

/* ═══════════════════════════════════════════════════════════
   Admin-controlled ON/OFF switch for SMM service categories
   (social media platforms).

   Kept OUT of marketplace-pricing.ts on purpose: that module is
   imported by client components, while this helper reads the
   database and must stay server-only.

   Contract: a category WITHOUT a MarketplaceCategorySetting row
   is ENABLED (default-on). Only a row with enabled=false turns a
   category off, so the feature ships with zero behavior change
   and never needs seeding.

   Disabled category means, for customers:
     - tile hidden from the storefront category grid
     - its services excluded from the public services list
     - service detail API returns 404
     - order creation is rejected
   Existing orders and admin fulfilment are NOT affected.
   ═══════════════════════════════════════════════════════════ */

/**
 * Set of category IDs currently switched OFF by the admin.
 * Fails OPEN (empty set) on a transient DB error so the store
 * keeps its previous "all categories visible" behavior instead
 * of blanking out. Any real DB outage fails the request later
 * anyway, since every caller needs the DB for services too.
 */
export async function getDisabledCategories(): Promise<Set<string>> {
  try {
    const rows = await db.marketplaceCategorySetting.findMany({
      where: { enabled: false },
      select: { categoryId: true },
    })
    return new Set(rows.map((r) => r.categoryId))
  } catch (err) {
    console.error('[marketplace-categories] getDisabledCategories error:', err)
    return new Set()
  }
}
