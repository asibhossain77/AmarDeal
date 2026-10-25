import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireModerationView } from '@/lib/admin-moderation-guard'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — GET /api/admin/marketplace-products
   ALL marketplace products (every status) with seller info, product
   type, category, price, stock and publication status.
   Search / filter / sort + per-status stats + open-report counts.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireModerationView(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().slice(0, 100)
    const status = searchParams.get('status') || 'all' // all | pending | active | rejected | unpublished | removed | inactive | sold
    const itemType = searchParams.get('itemType') || 'all' // all | physical | non_physical
    const sellerId = (searchParams.get('sellerId') || '').trim()
    const sort = searchParams.get('sort') || 'newest' // newest | oldest | price_asc | price_desc | title

    const where: Record<string, unknown> = {}
    if (status !== 'all') where.status = status
    if (itemType === 'physical' || itemType === 'non_physical') where.itemType = itemType
    if (sellerId) where.sellerId = sellerId
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { seller: { is: { OR: [{ name: { contains: q } }, { email: { contains: q } }, { businessName: { contains: q } }] } } },
      ]
    }

    const orderBy =
      sort === 'oldest' ? { createdAt: 'asc' as const }
      : sort === 'price_asc' ? { price: 'asc' as const }
      : sort === 'price_desc' ? { price: 'desc' as const }
      : sort === 'title' ? { title: 'asc' as const }
      : { createdAt: 'desc' as const }

    const [products, statusCounts, openReportByTarget] = await Promise.all([
      db.digitalProduct.findMany({
        where,
        select: {
          id: true, title: true, price: true, category: true, image: true,
          itemType: true, digitalKind: true, productType: true, status: true,
          quantity: true, isFree: true,
          moderationNote: true, moderatedAt: true, moderatedByName: true,
          createdAt: true, updatedAt: true, sellerId: true,
          seller: {
            select: {
              id: true, name: true, email: true, businessName: true,
              sellerRole: true, businessVerified: true, sellerDisabled: true,
            },
          },
        },
        orderBy,
        take: 200,
      }),
      db.digitalProduct.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      db.moderationReport.groupBy({
        by: ['targetId'],
        _count: { targetId: true },
        where: { targetType: 'product', status: { in: ['pending', 'under_review'] } },
      }),
    ])

    const countMap: Record<string, number> = {}
    let total = 0
    for (const row of statusCounts) {
      countMap[row.status] = row._count.status
      total += row._count.status
    }
    const reportCountMap = new Map(openReportByTarget.map(r => [r.targetId, r._count.targetId]))

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        sellerDisabled: !!p.seller?.sellerDisabled,
        openReports: reportCountMap.get(p.id) || 0,
      })),
      stats: {
        total,
        pending: countMap['pending'] || 0,
        active: countMap['active'] || 0,
        rejected: countMap['rejected'] || 0,
        unpublished: countMap['unpublished'] || 0,
        removed: countMap['removed'] || 0,
        reported: openReportByTarget.reduce((acc, r) => acc + r._count.targetId, 0),
      },
    })
  } catch (err) {
    console.error('[admin-marketplace-products ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
