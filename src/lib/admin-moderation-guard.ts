import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, type AdminRecord } from './admin-guard'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — RBAC for marketplace moderation admin APIs.

   Mirrors the admin-finance-guard philosophy:
   - Any active admin (incl. support) may VIEW moderation data —
     support staff are administrators and need read access to
     reports/verification context to answer tickets.
   - Sensitive ACTIONS (suspend sellers, change product status,
     decide reports) are restricted to:
       super_admin: always
       staff: only when the specific panel was granted in their
         permissions (JSON list, same model the admin nav uses)
       support: NEVER (consistent with review-moderation and
         finance panels being excluded from SUPPORT_ALLOWED)

   The admin nav hides these panels for unauthorized roles AND the
   APIs re-check server-side — hiding UI is never the security layer.
   ═══════════════════════════════════════════════════════════════ */

export type ModerationPanel = 'marketplace-sellers' | 'marketplace-products' | 'moderation-reports'

export type ModerationGuardResult =
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

/** View access: any active administrator (super_admin / staff / support). */
export async function requireModerationView(
  req: NextRequest,
): Promise<ModerationGuardResult> {
  return requireAdmin(req)
}

/** Action access: super_admin always; staff with the panel permission; support never. */
export async function requireModerationAction(
  req: NextRequest,
  panel: ModerationPanel,
): Promise<ModerationGuardResult> {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard
  const { admin } = guard

  if (admin.role === 'super_admin') return guard
  if (admin.role === 'staff' && staffHasPanel(admin, panel)) return guard

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'এই মডারেশন কাজের অনুমতি আপনার নেই', code: 'FORBIDDEN' },
      { status: 403 },
    ),
  }
}
