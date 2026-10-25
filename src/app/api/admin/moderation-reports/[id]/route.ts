import { NextRequest, NextResponse } from 'next/server'
import { requireModerationAction } from '@/lib/admin-moderation-guard'
import { decideModerationReport, type ReportDecision, type ReportResolution } from '@/lib/marketplace-moderation'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — PATCH /api/admin/moderation-reports/[id]
   Report decisions (who decided, when, why — always recorded):
     { action: 'start_review' }
     { action: 'resolve', resolution, note }
         resolution ∈ no_action | product_unpublished | product_removed
                    | product_restored | seller_suspended | seller_restricted
         → the linked moderation action is EXECUTED through the same
           shared helpers the sellers/products panels use.
     { action: 'reject', note }   → report dismissed (false report etc.)
   ═══════════════════════════════════════════════════════════════ */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireModerationAction(req, 'moderation-reports')
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    const action = body?.action as ReportDecision | undefined
    const resolution = body?.resolution as ReportResolution | undefined
    const note = typeof body?.note === 'string' ? body.note : undefined

    if (!action || !['start_review', 'resolve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
    }

    const r = await decideModerationReport(id, action, resolution, note, guard.admin)
    return NextResponse.json(r.ok ? { success: true, message: r.message } : { error: r.error }, {
      status: r.ok ? 200 : r.status,
    })
  } catch (err) {
    console.error('[admin-moderation-report-decide ERROR]', err)
    return NextResponse.json({ error: 'অ্যাকশন ব্যর্থ হয়েছে' }, { status: 500 })
  }
}
