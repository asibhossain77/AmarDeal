import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/order-audit — admin decision audit trail
   (cancellations, refunds, disputes, order actions).
   Filters: action (prefix), targetType. Newest first.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const action = (searchParams.get('action') || '').trim()
    const targetType = (searchParams.get('targetType') || '').trim()
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 200)

    const where: Record<string, unknown> = {}
    if (action) where.action = { contains: action }
    if (['refund_request', 'cancellation_request', 'dispute', 'order', 'payment',
         'seller', 'product', 'moderation_report', 'seller_application'].includes(targetType)) {
      where.targetType = targetType
    }

    const [logs, actionCounts] = await Promise.all([
      db.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.adminAuditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
    ])

    return NextResponse.json({ logs, actionCounts })
  } catch (err) {
    console.error('[admin-order-audit ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
