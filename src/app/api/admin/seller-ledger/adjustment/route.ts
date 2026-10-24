import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceAdmin } from '@/lib/admin-finance-guard'
import { recordAdjustment } from '@/lib/seller-ledger'
import { logAdminAction } from '@/lib/order-protection'
import { notifyUser } from '@/lib/push'

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/seller-ledger/adjustment — manual financial
   correction for ONE seller (± amount, reason REQUIRED).

   - Lands in the seller's itemized ledger with the admin's name,
     reason and a unique adjustment reference (transaction trail).
   - Lands in the AdminAuditLog (write-once).
   - The seller is notified immediately.
   - Rejected: zero amounts, missing reason, unknown seller.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const guard = await requireFinanceAdmin(req, 'seller-financials')
  if (!guard.ok) return guard.response
  try {
    const admin = guard.admin
    const body = await req.json().catch(() => ({})) as {
      sellerId?: string
      amount?: unknown
      reason?: string
    }

    const sellerId = (body.sellerId || '').trim()
    const amount = Number(body.amount)
    const reason = (body.reason || '').trim()

    if (!sellerId || !Number.isFinite(amount) || Math.round(amount * 100) === 0) {
      return NextResponse.json(
        { error: 'সেলার আইডি এবং অশূন্য পরিমাণ দিন', code: 'INVALID_INPUT' },
        { status: 400 },
      )
    }
    if (Math.abs(amount) > 10_000_000) {
      return NextResponse.json(
        { error: 'এত বড় সমন্বয় অনুমোদিত নয়', code: 'AMOUNT_TOO_LARGE' },
        { status: 400 },
      )
    }
    if (reason.length < 3) {
      return NextResponse.json(
        { error: 'সমন্বয়ের কারণ লিখুন (কমপক্ষে ৩ অক্ষর)', code: 'REASON_REQUIRED' },
        { status: 400 },
      )
    }

    const seller = await db.user.findUnique({
      where: { id: sellerId },
      select: { id: true, name: true, isSeller: true },
    })
    if (!seller || !seller.isSeller) {
      return NextResponse.json({ error: 'সেলার পাওয়া যায়নি', code: 'SELLER_NOT_FOUND' }, { status: 404 })
    }

    const entry = await recordAdjustment({
      sellerId,
      amount,
      reason,
      adminId: admin.userId,
      adminName: admin.user.name,
    })
    if (!entry) {
      return NextResponse.json({ error: 'সমন্বয় সংরক্ষণ করা যায়নি' }, { status: 500 })
    }

    await logAdminAction({
      adminId: admin.userId,
      adminName: admin.user.name,
      action: amount > 0 ? 'ledger_adjustment_credit' : 'ledger_adjustment_debit',
      targetType: 'ledger',
      targetId: entry.id,
      details: { sellerId, amount, reason },
    })

    await notifyUser({
      userId: sellerId,
      type: 'ledger_adjustment',
      title: 'ব্যালেন্স সমন্বয়',
      message: `${amount > 0 ? '+' : '−'}৳${Math.abs(amount).toLocaleString('en')} সমন্বয় করা হয়েছে — কারণ: ${reason.slice(0, 160)}`,
      relatedType: 'ledger',
      relatedId: entry.id,
    }).catch(() => {})

    return NextResponse.json({ success: true, adjustmentId: entry.id })
  } catch (err) {
    console.error('[ADMIN ADJUSTMENT ERROR]', err)
    return NextResponse.json({ error: 'সমন্বয় করতে সমস্যা' }, { status: 500 })
  }
}
