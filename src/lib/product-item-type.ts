/* ═══════════════════════════════════════════════════════════════
   Product ITEM TYPE (Task 82) — physical vs the existing
   non-physical seller products.

   NOTE: DigitalProduct.productType ("single" | "multi") is the
   PRICING structure and was already taken. This module adds the
   ITEM kind on a separate column: DigitalProduct.itemType.

   Rules shared by POST/PATCH /api/products*, POST /api/orders and
   the status routes — one source of truth, server-side only:
   - physical items are tangible: stock (quantity) is real, they
     never carry a digital file, are never free, and are always
     single-price (no SMM-style option packages);
   - non_physical covers EVERY pre-existing seller product — the
     DB default keeps old listings non-physical, and Order Now is
     NOT available to them (Admin Deal + Message only);
   - platform-owned (admin-sold) products keep their existing
     direct-order behaviour regardless of item type.
   ═══════════════════════════════════════════════════════════════ */

export const ITEM_TYPES = ['physical', 'non_physical'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export function isItemType(v: unknown): v is ItemType {
  return typeof v === 'string' && (ITEM_TYPES as readonly string[]).includes(v)
}

/** Missing → 'non_physical' (backward compat: old clients / old rows).
    Invalid values → null so callers can 400 instead of guessing. */
export function normalizeItemType(v: unknown): ItemType | null {
  if (v === undefined || v === null || v === '') return 'non_physical'
  return isItemType(v) ? v : null
}

/** Product condition — physical items only, optional. */
export const ITEM_CONDITIONS = ['new', 'used'] as const
export type ItemCondition = (typeof ITEM_CONDITIONS)[number]

export function isItemCondition(v: unknown): v is ItemCondition {
  return typeof v === 'string' && (ITEM_CONDITIONS as readonly string[]).includes(v)
}

export const MAX_SHIPPING_INFO_LENGTH = 2000

/** Shipping / delivery info — optional free text for physical items. */
export function sanitizeShippingInfo(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_SHIPPING_INFO_LENGTH)
}
