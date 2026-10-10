import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseLinkTypes } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════
   GET /api/marketplace/services
   Public catalog of ADMIN-OWNED SMM services.

   Only published + active services are listed. Provider mapping
   and other internal fields are never exposed. There is no
   POST/PUT/DELETE here on purpose — services can only be managed
   via /api/admin/marketplace/services (requireAdmin).
   ═══════════════════════════════════════════════════════════ */

const VALID_CATEGORIES = [
  'design', 'development', 'content', 'marketing', 'education',
  'software', 'social_media', 'id', 'other',
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const search = (searchParams.get('search') || '').trim().slice(0, 100)

    const where: Record<string, unknown> = {
      status: 'published',
      isActive: true,
    }
    if (category && category !== 'all' && VALID_CATEGORIES.includes(category)) {
      where.category = category
    }

    const services = await db.marketplaceService.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        pricePerThousand: true,
        minQuantity: true,
        maxQuantity: true,
        linkTypes: true,
        deliveryEstimate: true,
        instructions: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })

    let result = services
    if (search) {
      const q = search.toLowerCase()
      result = services.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
      )
    }

    return NextResponse.json({
      success: true,
      services: result.map((s) => ({
        ...s,
        linkTypes: parseLinkTypes(s.linkTypes),
      })),
    })
  } catch (err) {
    console.error('[marketplace-services] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
