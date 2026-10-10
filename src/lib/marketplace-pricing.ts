/* ═══════════════════════════════════════════════════════════
   Marketplace Direct Order — server-side pricing & validation.

   Single source of truth for order totals. Never trust a
   client-submitted price or total amount: the client may only
   send serviceId, link, linkType and quantity.

   Decimal safety: all money math is done in integer poisha
   (1 BDT = 100 poisha) so floating-point drift can never
   change an order total.
   ═══════════════════════════════════════════════════════════ */

/** Pricing units the platform supports. "per_1000" is the classic SMM unit. */
export const PRICING_UNITS = ['per_1000'] as const
export type PricingUnit = (typeof PRICING_UNITS)[number]

/** Units represented by one pricing block (e.g. per_1000 → 1000) */
export const UNIT_SIZE: Record<PricingUnit, number> = {
  per_1000: 1000,
}

/** Human label for a pricing unit (customer-facing, English digits) */
export function pricingUnitLabel(unit: string): string {
  switch (unit) {
    case 'per_1000':
      return 'per 1,000'
    default:
      return unit
  }
}

/** Convert a float amount (BDT) to integer poisha. */
export function toPoisha(amount: number): number {
  return Math.round(amount * 100)
}

/** Convert integer poisha back to a float amount (BDT). */
export function fromPoisha(poisha: number): number {
  return poisha / 100
}

/**
 * Calculate the total price for an order, decimal-safe.
 *
 * Example: price ৳150 per 1,000 × 2,000 units = ৳300
 * Fractional results are rounded to the nearest poisha:
 * ৳150/1000 × 1,234 = ৳185.10
 */
export function calculateOrderTotal(
  pricePerThousand: number,
  quantity: number,
  unit: PricingUnit = 'per_1000',
): number {
  const unitSize = UNIT_SIZE[unit] ?? 1000
  const pricePoisha = toPoisha(pricePerThousand)
  const totalPoisha = Math.round((pricePoisha * quantity) / unitSize)
  return fromPoisha(Math.max(0, totalPoisha))
}

/** Strict positive-integer check for quantities coming from the client. */
export function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  )
}

/** Validate quantity against a service's configured min/max. */
export function validateQuantityAgainstService(
  quantity: number,
  minQuantity: number,
  maxQuantity: number,
): { ok: true } | { ok: false; reason: 'below_min' | 'above_max' } {
  if (quantity < minQuantity) return { ok: false, reason: 'below_min' }
  if (quantity > maxQuantity) return { ok: false, reason: 'above_max' }
  return { ok: true }
}

/** Supported target link types (admin configures per service). */
export const LINK_TYPES = [
  'profile',
  'post',
  'video',
  'page',
  'channel',
  'website',
  'other',
] as const
export type LinkType = (typeof LINK_TYPES)[number]

/** Parse the stored linkTypes JSON of a service; empty array = any link type allowed. */
export function parseLinkTypes(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t): t is string => typeof t === 'string' && t.length > 0)
  } catch {
    return []
  }
}

/**
 * Validate a customer-submitted target link.
 * Only http(s) URLs are accepted; length is capped; no whitespace.
 */
export function validateLinkUrl(
  raw: unknown,
): { ok: true; url: string } | { ok: false; reason: string } {
  if (typeof raw !== 'string') return { ok: false, reason: 'invalid' }
  const url = raw.trim()
  if (!url) return { ok: false, reason: 'required' }
  if (url.length > 2048) return { ok: false, reason: 'too_long' }
  if (/\s/.test(url)) return { ok: false, reason: 'invalid' }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, reason: 'invalid_protocol' }
    }
    return { ok: true, url }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

/* ── Order lifecycle ─────────────────────────────────────────
   pending_payment → queued → processing → in_progress → completed
   Side states: partial | cancelled | failed | refunded
   ────────────────────────────────────────────────────────── */

export const ORDER_STATUSES = [
  'pending_payment',
  'queued',
  'processing',
  'in_progress',
  'completed',
  'partial',
  'cancelled',
  'failed',
  'refunded',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = [
  'unpaid',
  'awaiting_verification',
  'paid',
  'failed',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Statuses where the customer may still cancel their unpaid order */
export const CUSTOMER_CANCELLABLE = new Set<string>(['pending_payment'])

/**
 * Allowed admin-driven fulfilment transitions.
 * Guarded on the server so a stale/duplicated request can never
 * move an order backwards or resurrect a finished order.
 */
const ADMIN_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['cancelled'],
  queued: ['processing', 'in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded'],
  processing: ['in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded'],
  in_progress: ['completed', 'partial', 'failed', 'cancelled', 'refunded'],
  partial: ['in_progress', 'completed', 'refunded', 'failed'],
  failed: ['queued', 'processing', 'in_progress', 'refunded'],
  completed: ['partial', 'refunded'],
  cancelled: [],
  refunded: [],
}

export function canAdminTransition(from: string, to: string): boolean {
  const allowed = ADMIN_TRANSITIONS[from]
  return !!allowed && allowed.includes(to)
}

/** Statuses that count as "money is settled" for reporting */
export const PAID_ORDER_STATUSES = new Set<string>([
  'queued',
  'processing',
  'in_progress',
  'completed',
  'partial',
  'refunded',
])

/** Generate a human-friendly order number: MP-XXXXXX (unambiguous charset) */
export function generateOrderNumber(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += charset[Math.floor(Math.random() * charset.length)]
  }
  return `MP-${suffix}`
}

/* ── Admin service field validation (shared create/update) ── */

export const SERVICE_CATEGORIES = [
  'design', 'development', 'content', 'marketing', 'education',
  'software', 'social_media', 'id', 'other',
]

function isValidPrice(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 1_000_000
  )
}

function sanitizeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Whitelist-based validation for admin service payloads.
 * Returns an error string, or null when the payload is acceptable.
 * `partial: true` validates only the provided fields (PATCH).
 */
export function validateServicePayload(body: Record<string, unknown>, partial: boolean): string | null {
  const has = (k: string) => body[k] !== undefined

  if (!partial || has('name')) {
    const name = sanitizeText(body.name, 200)
    if (!name) return 'Service name is required'
  }
  if (!partial || has('description')) {
    const description = sanitizeText(body.description, 5000)
    if (!description) return 'Service description is required'
  }
  if (!partial || has('category')) {
    const category = sanitizeText(body.category, 32) || 'other'
    if (!SERVICE_CATEGORIES.includes(category)) return 'Invalid category'
  }
  if (!partial || has('pricePerThousand')) {
    const price = body.pricePerThousand
    if (typeof price === 'string' && price.trim() !== '') body.pricePerThousand = Number(price)
    if (!isValidPrice(body.pricePerThousand)) return 'Price must be a positive number'
  }
  if (!partial || has('minQuantity')) {
    const min = Number(body.minQuantity)
    if (!Number.isInteger(min) || min < 1 || min > 10_000_000) return 'Minimum quantity must be a positive integer'
  }
  if (!partial || has('maxQuantity')) {
    const max = Number(body.maxQuantity)
    if (!Number.isInteger(max) || max < 1 || max > 10_000_000) return 'Maximum quantity must be a positive integer'
  }
  if (has('minQuantity') || has('maxQuantity')) {
    const min = Number(body.minQuantity)
    const max = Number(body.maxQuantity)
    if (Number.isInteger(min) && Number.isInteger(max) && max < min) {
      return 'Maximum quantity must be greater than or equal to minimum quantity'
    }
  }
  if (has('linkTypes')) {
    if (!Array.isArray(body.linkTypes)) return 'linkTypes must be an array'
    const all = (body.linkTypes as unknown[]).every(
      (t) => typeof t === 'string' && (LINK_TYPES as readonly string[]).includes(t),
    )
    if (!all) return 'Invalid link type'
  }
  if (has('status')) {
    const status = sanitizeText(body.status, 16)
    if (!['draft', 'published'].includes(status)) return 'Invalid status'
  }
  if (has('providerName')) {
    if (body.providerName !== null && typeof body.providerName !== 'string') return 'Invalid provider name'
  }
  if (has('providerServiceId')) {
    if (body.providerServiceId !== null && typeof body.providerServiceId !== 'string') return 'Invalid provider service id'
  }
  return null
}
