import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, type AdminRecord } from './admin-guard'

/* ═══════════════════════════════════════════════════════════════
   Phase 7 — RBAC for sensitive finance admin APIs.

   Who may touch commission rates, seller financial reports and
   manual ledger adjustments?
   - super_admin: always
   - staff: only when the specific panel was granted in their
     permissions (JSON list, same model the admin nav uses)
   - support: NEVER (support permissions intentionally exclude
     money-moving/configuration panels)

   The admin nav hides these panels for unauthorized roles AND the
   APIs re-check server-side — hiding UI is never the security layer.
   ═══════════════════════════════════════════════════════════════ */

export type FinanceGuardResult =
  | { ok: true; admin: AdminRecord }
  | { ok: false; response: NextResponse }

function staffHasPanel(admin: AdminRecord, panel: string): boolean {
  try {
    const perms = JSON.parse(admin.permissions || '[]') as string[]
    return Array.isArray(perms) && perms.includes(panel)
  } catch {
    return false
  }
}

export async function requireFinanceAdmin(
  req: NextRequest,
  panel: 'marketplace-commission' | 'seller-financials',
): Promise<FinanceGuardResult> {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard
  const { admin } = guard

  if (admin.role === 'super_admin') return guard
  if (admin.role === 'staff' && staffHasPanel(admin, panel)) return guard

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'এই আর্থিক কাজের অনুমতি আপনার নেই', code: 'FORBIDDEN' },
      { status: 403 },
    ),
  }
}
