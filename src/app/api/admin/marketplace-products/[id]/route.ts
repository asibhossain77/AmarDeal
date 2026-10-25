import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireModerationAction } from '@/lib/admin-moderation-guard'
import { moderateProduct, createModerationReport, type ModerationResult } from '@/lib/marketplace-moderation'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — PATCH /api/admin/marketplace-products/[id]
   Product moderation lifecycle:
     { action: 'approve', reason? }    pending → active
     { action: 'reject', reason }      pending → rejected (seller notified w/ reason)
     { action: 'unpublish', reason }   active/inactive → unpublished
     { action: 'remove', reason }      any → removed
     { action: 'restore', reason? }    rejected/unpublished/removed → active
     { action: 'flag', reason, details? }  → files a ModerationReport

   Every state change stores the reason on the product (seller-visible),
   notifies the seller and writes an append-only audit log entry —
   handled centrally by moderateProduct() in marketplace-moderation.ts.
   ═══════════════════════════════════════════════════════════════ */

function respondAction(r: ModerationResult, extra: Record<string, unknown> = {}) {
  return NextResponse.json(r.ok ? { success: true, message: r.message, ...extra } : { error: r.error }, {
    status: r.ok ? 200 : r.status,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireModerationAction(req, 'marketplace-products')
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    const action = body?.action
    const reason = typeof body?.reason === 'string' ? body.reason : undefined
    const details = typeof body?.details === 'string' ? body.details : undefined

    if (action === 'flag') {
      const r = await createModerationReport('product', id, reason || '', details, guard.admin)
      return respondAction(r, { reportId: (r as { reportId?: string }).reportId })
    }

    if (['approve', 'reject', 'unpublish', 'remove', 'restore'].includes(action)) {
      return respondAction(await moderateProduct(id, action, reason, guard.admin))
    }

    return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
  } catch (err) {
    console.error('[admin-marketplace-product-action ERROR]', err)
    return NextResponse.json({ error: 'অ্যাকশন ব্যর্থ হয়েছে' }, { status: 500 })
  }
}
