import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Support both raw CUID IDs and "DL-XXXXX" formatted IDs
    let dealId = id
    if (id.startsWith('DL-')) {
      const shortId = id.replace('DL-', '')
      const match = await db.deal.findFirst({
        where: { id: { endsWith: shortId } },
        select: { id: true },
      })
      if (!match) {
        return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
      }
      dealId = match.id
    }

    const guard = await requireDealAccess(req, dealId)
    if (!guard.ok) return guard.response

    const deal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true, imageLink: true } },
        seller: { select: { id: true, name: true, email: true, phone: true, imageLink: true } },
        creator: { select: { id: true, name: true, email: true } },
        paymentMethod: { select: { id: true, name: true, accountType: true } },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    return NextResponse.json(deal)
  } catch {
    return NextResponse.json({ error: 'ডিল লোড করতে সমস্যা' }, { status: 500 })
  }
}