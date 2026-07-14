import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json()

    if (!dealId) {
      return NextResponse.json({ error: 'ডিল আইডি প্রদান করুন' }, { status: 400 })
    }

    const deal = await db.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    // Prevent cancelling completed, cancelled, or rejected deals
    const finalStates = ['completed', 'cancelled', 'rejected']
    if (finalStates.includes(deal.status)) {
      return NextResponse.json(
        { error: 'এই ডিল আর বাতিল করা সম্ভব নয়' },
        { status: 400 }
      )
    }

    const updated = await db.deal.update({
      where: { id: dealId },
      data: { status: 'cancelled' },
      include: {
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'ডিল বাতিল করতে সমস্যা' }, { status: 500 })
  }
}