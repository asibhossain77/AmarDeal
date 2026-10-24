import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceAdmin } from '@/lib/admin-finance-guard'
import { MARKETPLACE_COMMISSION_KEY, getCommissionPercent } from '@/lib/seller-ledger'
import { logAdminAction } from '@/lib/order-protection'

/* ═══════════════════════════════════════════════════════════════
   GET  /api/admin/marketplace-commission — current commission rate.
   PUT  /api/admin/marketplace-commission — set the rate (0–100).

   The rate lives in PlatformSetting ('marketplace_commission_percent')
   — the SAME settings mechanism the affiliate commission uses. There
   is no hardcoded business rate anywhere: unset = 0 (platform takes
   nothing). Rate changes are AUDITED and only ever apply to FUTURE
   order completions — snapshots on existing ledger entries never
   change, so history can't be rewritten.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireFinanceAdmin(req, 'marketplace-commission')
  if (!guard.ok) return guard.response
  try {
    const percent = await getCommissionPercent()
    return NextResponse.json({ key: MARKETPLACE_COMMISSION_KEY, percent })
  } catch (err) {
    console.error('[ADMIN COMMISSION GET ERROR]', err)
    return NextResponse.json({ error: 'লোড করতে সমস্যা' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireFinanceAdmin(req, 'marketplace-commission')
  if (!guard.ok) return guard.response
  try {
    const admin = guard.admin
    const body = await req.json().catch(() => ({})) as { percent?: unknown }
    const v = Number(body.percent)
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return NextResponse.json(
        { error: 'কমিশন ০ থেকে ১০০ এর মধ্যে হতে হবে', code: 'INVALID_PERCENT' },
        { status: 400 },
      )
    }
    const percent = Math.round(v * 100) / 100

    await db.platformSetting.upsert({
      where: { key: MARKETPLACE_COMMISSION_KEY },
      create: { key: MARKETPLACE_COMMISSION_KEY, value: String(percent) },
      update: { value: String(percent) },
    })

    await logAdminAction({
      adminId: admin.userId,
      adminName: admin.user.name,
      action: 'commission_rate_changed',
      targetType: 'commission_setting',
      targetId: MARKETPLACE_COMMISSION_KEY,
      details: { percent, note: 'applies to future order completions only' },
    })

    return NextResponse.json({ success: true, percent })
  } catch (err) {
    console.error('[ADMIN COMMISSION PUT ERROR]', err)
    return NextResponse.json({ error: 'সংরক্ষণ করতে সমস্যা' }, { status: 500 })
  }
}
