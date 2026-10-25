import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireModerationView } from '@/lib/admin-moderation-guard'
import { ensureSchema } from '@/lib/ensure-schema'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — GET /api/admin/marketplace-monitor
   Marketplace overview statistics:
   sellers (registered / business / verified / pending verification
   applications / suspended / restricted), products (total / active /
   pending / rejected / unpublished / removed), reports (open +
   under review, review reports) and the recent moderation activity
   feed (from the append-only AdminAuditLog).
   Kept clearly SEPARATE from /api/admin/stats — Marketplace Orders
   and Admin Deals are not mixed here.
   ═══════════════════════════════════════════════════════════════ */

type Counts = Record<string, number>

function safeCount(p: Promise<number>): Promise<number> {
  return p.catch(() => 0)
}

export async function GET(req: NextRequest) {
  const guard = await requireModerationView(req)
  if (!guard.ok) return guard.response

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  async function collect(): Promise<{
    sellers: Counts; products: Counts; reports: Counts; recent: unknown[]
  }> {
    const [
      totalSellers, businessSellers, verifiedBusiness, pendingVerification,
      suspendedSellers, restrictedSellers, newSellers30d,
      totalProducts, activeProducts, pendingProducts, rejectedProducts, unpublishedProducts, removedProducts,
      openReports, underReviewReports, resolvedReports, rejectedReports, openReviewReports,
      recent,
    ] = await Promise.all([
      safeCount(db.user.count({ where: { isSeller: true } })),
      safeCount(db.user.count({ where: { isSeller: true, sellerRole: 'business' } })),
      safeCount(db.user.count({ where: { isSeller: true, businessVerified: true } })),
      safeCount(db.sellerApplication.count({ where: { status: 'pending' } })),
      safeCount(db.user.count({ where: { isSeller: true, sellerDisabled: true } })),
      safeCount(db.user.count({ where: { isSeller: true, sellerRestricted: true } })),
      safeCount(db.user.count({ where: { isSeller: true, createdAt: { gte: since30d } } })),
      safeCount(db.digitalProduct.count()),
      safeCount(db.digitalProduct.count({ where: { status: 'active' } })),
      safeCount(db.digitalProduct.count({ where: { status: 'pending' } })),
      safeCount(db.digitalProduct.count({ where: { status: 'rejected' } })),
      safeCount(db.digitalProduct.count({ where: { status: 'unpublished' } })),
      safeCount(db.digitalProduct.count({ where: { status: 'removed' } })),
      safeCount(db.moderationReport.count({ where: { status: 'pending' } })),
      safeCount(db.moderationReport.count({ where: { status: 'under_review' } })),
      safeCount(db.moderationReport.count({ where: { status: 'resolved' } })),
      safeCount(db.moderationReport.count({ where: { status: 'rejected' } })),
      safeCount(db.reviewReport.count({ where: { status: 'open' } })),
      db.adminAuditLog.findMany({
        where: { targetType: { in: ['seller', 'product', 'moderation_report', 'seller_application'] } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ])

    return {
      sellers: {
        totalSellers, businessSellers, verifiedBusiness, pendingVerification,
        suspendedSellers, restrictedSellers, newSellers30d,
      },
      products: {
        totalProducts, activeProducts, pendingProducts, rejectedProducts, unpublishedProducts, removedProducts,
      },
      reports: {
        openReports, underReviewReports, resolvedReports, rejectedReports,
        totalReports: openReports + underReviewReports + resolvedReports + rejectedReports,
        openReviewReports,
      },
      recent,
    }
  }

  try {
    try {
      const data = await collect()
      return NextResponse.json(data)
    } catch {
      // Schema drift (e.g. production before first heal) — heal once, retry
      await ensureSchema()
      const data = await collect()
      return NextResponse.json(data)
    }
  } catch (err) {
    console.error('[admin-marketplace-monitor ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
