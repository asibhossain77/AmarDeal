import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const deals = await db.deal.findMany({
      where: {
        OR: [
          { buyerId: id },
          { sellerId: id },
          { creatorId: id },
        ],
      },
      select: {
        id: true,
        title: true,
        amount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(deals)
  } catch (err) {
    console.error('Fetch user deals error:', err)
    return NextResponse.json(
      { error: 'ডিল লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}