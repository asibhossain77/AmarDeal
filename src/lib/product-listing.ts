/* ================================================
   Verified Business Seller listing helpers (Phase 2)
   =================================================
   Product listings for admin-approved Verified Business Sellers build on
   the Task-82 item system (itemType physical/non_physical, stock,
   condition, shippingInfo) and add:
     - backend gating: physical listings require a verified business seller
     - seller publish/unpublish management (status active/inactive)
     - digitalKind classification for non-physical products
     - PRIVATE deliveryDetails for digital products (owner/admin only)
     - multi-image gallery (images JSON, images[0] mirrors `image`)
   ================================================ */

export const VALID_DIGITAL_KINDS = [
  'file',
  'account',
  'license',
  'subscription',
  'other',
] as const
export type DigitalKind = (typeof VALID_DIGITAL_KINDS)[number]

/** Max gallery images per product (first one is the cover). */
export const MAX_PRODUCT_IMAGES = 6

/**
 * A Verified Business Seller = admin-approved business seller.
 * True only when ALL of: isSeller, not disabled, role 'business',
 * businessVerified (set when admin approves a business application).
 */
export function isVerifiedBusinessSeller(
  user: {
    isSeller: boolean
    sellerDisabled?: boolean | null
    sellerRole?: string | null
    businessVerified?: boolean | null
  } | null | undefined
): boolean {
  return (
    !!user?.isSeller &&
    !user?.sellerDisabled &&
    user?.sellerRole === 'business' &&
    user?.businessVerified === true
  )
}

/** Sanitize an incoming images value (array or JSON string) → clean URL list. */
export function sanitizeProductImages(input: unknown): string[] {
  let list: unknown[] = []
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      list = []
    }
  } else if (Array.isArray(input)) {
    list = input
  }
  const cleaned = list
    .filter((u): u is string => typeof u === 'string')
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && u.length <= 2048)
  return Array.from(new Set(cleaned)).slice(0, MAX_PRODUCT_IMAGES)
}

/** Parse the stored images JSON column → string[] (never null). */
export function parseStoredImages(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : []
  } catch {
    return []
  }
}

/** Trim a free-text field; returns null when empty. Caps length. */
export function sanitizeListingText(input: unknown, maxLength: number): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}
