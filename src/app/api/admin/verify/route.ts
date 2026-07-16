import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const { dealId } = await req.json()

    if (!dealId) {
      return NextResponse.json({ error: 'ডিল আইডি প্রদান করুন' }, { status: 400 })
    }

    const deal = await db.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    // Enforce linear workflow: only payment_pending deals can be verified
    if (deal.status !== 'payment_pending') {
      return NextResponse.json(
        { error: `শুধুমাত্র পেমেন্ট পেন্ডিং ডিল ভেরিফাই করা যায় (বর্তমান অবস্থা: ${deal.status})` },
        { status: 400 }
      )
    }

    const updated = await db.deal.update({
      where: { id: dealId },
      data: { status: 'payment_verified' },
      include: {
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ভেরিফিকেশনে সমস্যা' }, { status: 500 })
  }
}