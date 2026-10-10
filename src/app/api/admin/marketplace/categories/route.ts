import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { SERVICE_CATEGORIES } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════
   GET   /api/admin/marketplace/categories
         Every social-platform category with its ON/OFF state
         and storefront-visible service counts.

   PATCH /api/admin/marketplace/categories
         Body: { categoryId, enabled } — toggles one category.

   ADMIN-ONLY (requireAdmin). Category visibility is a platform
   decision — regular users can never read this endpoint's
   counts or change any flag.
   ═══════════════════════════════════════════════════════════ */

const VALID_CATEGORIES: readonly string[] = SERVICE_CATEGORIES

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const [settings, visibleCounts, allCounts] = await Promise.all([
      db.marketplaceCategorySetting.findMany({ select: { categoryId: true, enabled: true } }),
      db.marketplaceService.groupBy({
        by: ['category'],
        where: { status: 'published', isActive: true },
        _count: { _all: true },
      }),
      db.marketplaceService.groupBy({
        by: ['category'],
        _count: { _all: true },
      }),
    ])

    const disabled = new Set(
      settings.filter((s) => !s.enabled).map((s) => s.categoryId),
    )
    const visible = new Map(visibleCounts.map((c) => [c.category, c._count._all]))
    const total = new Map(allCounts.map((c) => [c.category, c._count._all]))

    return NextResponse.json({
      success: true,
      categories: SERVICE_CATEGORIES.map((categoryId) => ({
        categoryId,
        enabled: !disabled.has(categoryId),
        serviceCount: visible.get(categoryId) || 0,
        totalServiceCount: total.get(categoryId) || 0,
      })),
    })
  } catch (err) {
    console.error('[admin-mp-categories] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
    if (!VALID_CATEGORIES.includes(categoryId)) {
      return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 })
    }
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 })
    }

    // Upsert keeps the default-on contract: enabling just clears the
    // flag (or stores true), disabling stores a persistent row.
    const setting = await db.marketplaceCategorySetting.upsert({
      where: { categoryId },
      update: { enabled: body.enabled },
      create: { categoryId, enabled: body.enabled },
    })

    return NextResponse.json({
      success: true,
      category: { categoryId: setting.categoryId, enabled: setting.enabled },
    })
  } catch (err) {
    console.error('[admin-mp-categories] PATCH error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
