import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { validateServicePayload, parseLinkTypes } from '@/lib/marketplace-pricing'

/* ═══════════════════════════════════════════════════════════
   GET    /api/admin/marketplace/services/[id] — full detail
   PATCH  /api/admin/marketplace/services/[id] — partial update
   DELETE /api/admin/marketplace/services/[id] — remove service

   ADMIN-ONLY. Every field is whitelisted — a client can never
   inject unknown or computed fields (mass-assignment safe).
   Deletion is refused when orders exist (suggest pausing
   instead) so historical order totals keep their references.
   ═══════════════════════════════════════════════════════════ */

function sanitizeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const service = await db.marketplaceService.findUnique({ where: { id } })
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
    }
    const orderCount = await db.marketplaceOrder.count({ where: { serviceId: id } })
    return NextResponse.json({
      success: true,
      service: { ...service, linkTypes: parseLinkTypes(service.linkTypes), orderCount },
    })
  } catch (err) {
    console.error('[admin-mp-service] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const b = body as Record<string, unknown>

    const existing = await db.marketplaceService.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
    }

    const error = validateServicePayload(b, true)
    if (error) return NextResponse.json({ success: false, error }, { status: 400 })

    // Whitelist — only known fields ever reach Prisma
    const data: Record<string, unknown> = {}
    if (b.name !== undefined) data.name = sanitizeText(b.name, 200)
    if (b.category !== undefined) data.category = sanitizeText(b.category, 32) || 'other'
    if (b.description !== undefined) data.description = sanitizeText(b.description, 5000)
    if (b.pricePerThousand !== undefined) data.pricePerThousand = Number(b.pricePerThousand)
    if (b.minQuantity !== undefined) data.minQuantity = Number(b.minQuantity)
    if (b.maxQuantity !== undefined) data.maxQuantity = Number(b.maxQuantity)
    if (b.linkTypes !== undefined) data.linkTypes = JSON.stringify(b.linkTypes)
    if (b.deliveryEstimate !== undefined) data.deliveryEstimate = sanitizeText(b.deliveryEstimate, 100) || null
    if (b.instructions !== undefined) data.instructions = sanitizeText(b.instructions, 2000) || null
    if (b.status !== undefined) data.status = sanitizeText(b.status, 16)
    if (b.isActive !== undefined) data.isActive = Boolean(b.isActive)
    if (b.sortOrder !== undefined) data.sortOrder = Number.isInteger(Number(b.sortOrder)) ? Number(b.sortOrder) : 0

    const service = await db.marketplaceService.update({ where: { id }, data })

    return NextResponse.json({ success: true, service })
  } catch (err) {
    console.error('[admin-mp-service] PATCH error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const existing = await db.marketplaceService.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
    }

    const orderCount = await db.marketplaceOrder.count({ where: { serviceId: id } })
    if (orderCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `এই সার্ভিসে ${orderCount} টি অর্ডার আছে — ডিলিট করা যাবে না। এর বদলে সার্ভিসটি Unpublish/Pause করুন।`,
        },
        { status: 409 },
      )
    }

    await db.marketplaceService.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin-mp-service] DELETE error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
