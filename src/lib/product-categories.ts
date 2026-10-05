/* ═══════════════════════════════════════════════════════════════
   PRODUCT CATEGORIES — single source of truth
   Used by: POST /api/products (create), PATCH /api/products/[id]
   (edit), GET /api/products (filter). Keeping one list prevents
   the drift that made edits of facebook/instagram/subscription/
   free_service products fail with "অবৈধ ক্যাটাগরি" (Task 40).
   ═══════════════════════════════════════════════════════════════ */

export const PRODUCT_CATEGORIES = [
  'design',
  'development',
  'content',
  'marketing',
  'education',
  'software',
  'social_media',
  'id',
  'facebook',
  'instagram',
  'subscription',
  'free_service',
  'other',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export function isValidProductCategory(value: unknown): value is ProductCategory {
  return typeof value === 'string' && (PRODUCT_CATEGORIES as readonly string[]).includes(value)
}
