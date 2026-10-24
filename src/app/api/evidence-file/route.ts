import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'
import { presignDownload } from '@/lib/r2'

export const dynamic = 'force-dynamic'

/* ═══════════════════════════════════════════════════════════════
   GET /api/evidence-file?key=…&orderId=…

   Participant-guarded evidence download. The key MUST live inside
   the order's own `evidence/<orderId>/…` space — a forged pair of
   orderId + key pointing at another order's (or any other) object
   is rejected. Returns a short-lived presigned R2 URL.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key') ?? ''
    const orderId = searchParams.get('orderId') ?? ''

    if (!key || !orderId || key.includes('..') || !key.startsWith(`evidence/${orderId}/`)) {
      return NextResponse.json({ error: 'অবৈধ ফাইল রেফারেন্স' }, { status: 400 })
    }

    const order = await db.marketplaceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, sellerId: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 })
    }

    const isAdmin = !!(await getAdminFromRequest(req))
    const isBuyer = order.userId === guard.userId
    const isSeller = !!order.sellerId && order.sellerId === guard.userId
    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 403 })
    }

    const fileName = key.split('/').pop() ?? 'file'
    const url = await presignDownload(key, decodeURIComponent(searchParams.get('name') || fileName))
    return NextResponse.json({ success: true, url })
  } catch (err) {
    console.error('[evidence-file GET] Failed:', err instanceof Error ? err.message : err)
    const msg = err instanceof Error && /R2 credentials|not configured/i.test(err.message)
      ? 'ফাইল স্টোরেজ এখনো কনফিগার করা হয়নি'
      : 'ফাইল লোড করতে সমস্যা হয়েছে'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
