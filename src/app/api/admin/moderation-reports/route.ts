import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireModerationView } from '@/lib/admin-moderation-guard'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — GET /api/admin/moderation-reports
   Centralized report management for reported SELLERS and PRODUCTS
   (review reports live in the existing review-moderation panel;
   their open count is included here so the section stays the
   single monitoring entry point).
   Filters: targetType, status, q. Newest first.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireModerationView(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const targetType = searchParams.get('targetType') || 'all' // all | seller | product
    const status = searchParams.get('status') || 'all' // all | pending | under_review | resolved | rejected
    const q = (searchParams.get('q') || '').trim().slice(0, 100)

    const where: Record<string, unknown> = {}
    if (targetType === 'seller' || targetType === 'product') where.targetType = targetType
    if (status !== 'all') where.status = status
    if (q) {
      where.OR = [
        { targetLabel: { contains: q } },
        { reason: { contains: q } },
        { reporterName: { contains: q } },
      ]
    }

    const [reports, statusCounts, reviewStats] = await Promise.all([
      db.moderationReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      db.moderationReport.groupBy({ by: ['status'], _count: { status: true } }),
      Promise.all([
        db.reviewReport.count({ where: { status: 'open' } }),
        db.reviewReport.count(),
      ]),
    ])

    const countMap: Record<string, number> = {}
    for (const row of statusCounts) countMap[row.status] = row._count.status

    return NextResponse.json({
      reports,
      stats: {
        pending: countMap['pending'] || 0,
        underReview: countMap['under_review'] || 0,
        resolved: countMap['resolved'] || 0,
        rejected: countMap['rejected'] || 0,
        openReviewReports: reviewStats[0],
        totalReviewReports: reviewStats[1],
      },
    })
  } catch (err) {
    console.error('[admin-moderation-reports ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
