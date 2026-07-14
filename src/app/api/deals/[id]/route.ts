import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Support both raw CUID IDs and "DL-XXXXX" formatted IDs
    let dealId = id
    if (id.startsWith('DL-')) {
      // Try to find deal by last chars of ID
      const shortId = id.replace('DL-', '')
      const deals = await db.deal.findMany({
        where: { id: { endsWith: shortId } },
        include: {
          buyer: { select: { id: true, name: true, email: true, phone: true } },
          seller: { select: { id: true, name: true, email: true, phone: true } },
          creator: { select: { id: true, name: true, email: true } },
          paymentMethod: { select: { id: true, name: true, accountType: true } },
        },
        take: 1,
      })
      if (deals.length === 0) {
        return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
      }
      return NextResponse.json(deals[0])
    }

    const deal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
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