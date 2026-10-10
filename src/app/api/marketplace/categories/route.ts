import { NextResponse } from 'next/server'
import { SERVICE_CATEGORIES } from '@/lib/marketplace-pricing'
import { getDisabledCategories } from '@/lib/marketplace-categories'

/* ═══════════════════════════════════════════════════════════
   GET /api/marketplace/categories
   Public: the category tiles the storefront should render.
   Categories the admin has switched OFF are NOT listed —
   customers can neither see nor filter by them.

   Labels/icons are derived client-side from the canonical
   SERVICE_CATEGORIES + SERVICE_CATEGORY_LABELS map, so this
   endpoint only needs to return keys.
   ═══════════════════════════════════════════════════════════ */

export async function GET() {
  try {
    const disabled = await getDisabledCategories()
    return NextResponse.json({
      success: true,
      categories: (SERVICE_CATEGORIES as readonly string[]).filter((c) => !disabled.has(c)),
    })
  } catch (err) {
    console.error('[marketplace-categories] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
