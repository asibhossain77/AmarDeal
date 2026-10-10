import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseLinkTypes } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════
   GET /api/marketplace/services/[id]
   Public detail of a single published service.
   Draft / paused services return 404 — they cannot be ordered
   or discovered. No admin-only fields are exposed.
   ═══════════════════════════════════════════════════════════ */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const service = await db.marketplaceService.findFirst({
      where: { id, status: 'published', isActive: true },
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
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found or not available' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      service: { ...service, linkTypes: parseLinkTypes(service.linkTypes) },
    })
  } catch (err) {
    console.error('[marketplace-service-detail] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
