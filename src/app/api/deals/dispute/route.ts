import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const { dealId } = await req.json()

    if (!dealId) {
      return NextResponse.json({ error: 'ডিল আইডি প্রদান করুন' }, { status: 400 })
    }

    const deal = await db.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (deal.status !== 'in_delivery') {
      return NextResponse.json(
        { error: 'শুধুমাত্র ডেলিভারি পর্যায়ের ডিলে বিরোধ দায়ের করা যায়' },
        { status: 400 }
      )
    }

    const updated = await db.deal.update({
      where: { id: dealId },
      data: { status: 'disputed' },
      include: {
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'বিরোধ দায়েরে সমস্যা' }, { status: 500 })
  }
}