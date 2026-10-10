import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { LINK_TYPES, parseLinkTypes, validateServicePayload } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════
   GET  /api/admin/marketplace/services — list all services + stats
   POST /api/admin/marketplace/services — create a service

   ADMIN-ONLY (requireAdmin). There is deliberately NO public or
   user-level write path for services anywhere in the codebase —
   regular users cannot create, edit, price, publish or delete
   Marketplace services through ANY endpoint.
   ═══════════════════════════════════════════════════════════ */

const VALID_CATEGORIES = [
  'design', 'development', 'content', 'marketing', 'education',
  'software', 'social_media', 'id', 'other',
]

function sanitizeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category && category !== 'all' && VALID_CATEGORIES.includes(category)) where.category = category

    const [services, orderCounts, total] = await Promise.all([
      db.marketplaceService.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      db.marketplaceOrder.groupBy({
        by: ['serviceId'],
        _count: { _all: true },
      }),
      db.marketplaceService.count({ where }),
    ])

    const counts = new Map(orderCounts.map((c) => [c.serviceId, c._count._all]))

    return NextResponse.json({
      success: true,
      services: services.map((s) => ({
        ...s,
        linkTypes: parseLinkTypes(s.linkTypes),
        orderCount: counts.get(s.id) || 0,
      })),
      total,
    })
  } catch (err) {
    console.error('[admin-mp-services] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const b = body as Record<string, unknown>

    const error = validateServicePayload(b, false)
    if (error) return NextResponse.json({ success: false, error }, { status: 400 })

    const status = sanitizeText(b.status, 16) || 'draft'
    const minQuantity = Number(b.minQuantity)
    const maxQuantity = Number(b.maxQuantity)
    const linkTypes = Array.isArray(b.linkTypes) ? (b.linkTypes as string[]) : []

    const service = await db.marketplaceService.create({
      data: {
        name: sanitizeText(b.name, 200),
        category: sanitizeText(b.category, 32) || 'other',
        description: sanitizeText(b.description, 5000),
        pricePerThousand: Number(b.pricePerThousand),
        minQuantity,
        maxQuantity,
        linkTypes: JSON.stringify(linkTypes),
        deliveryEstimate: sanitizeText(b.deliveryEstimate, 100) || null,
        instructions: sanitizeText(b.instructions, 2000) || null,
        status,
        isActive: b.isActive === undefined ? true : Boolean(b.isActive),
        providerName: sanitizeText(b.providerName, 100) || null,
        providerServiceId: sanitizeText(b.providerServiceId, 100) || null,
        sortOrder: Number.isInteger(Number(b.sortOrder)) ? Number(b.sortOrder) : 0,
        createdById: guard.admin.userId,
      },
    })

    return NextResponse.json({ success: true, service }, { status: 201 })
  } catch (err) {
    console.error('[admin-mp-services] POST error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
