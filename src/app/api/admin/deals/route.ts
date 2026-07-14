import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const deals = await db.deal.findMany({
      include: {
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
        creator: { select: { name: true, email: true } },
        paymentMethod: { select: { id: true, name: true, accountNumber: true, accountType: true, image: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(deals)
  } catch {
    return NextResponse.json(
      { error: 'ডিল লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}