import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const tid = req.nextUrl.searchParams.get('tid')?.trim()
    const excludeDealId = req.nextUrl.searchParams.get('dealId')?.trim()

    if (!tid) {
      return NextResponse.json({ exists: false })
    }

    const deal = await db.deal.findFirst({
      where: {
        transactionId: tid,
        ...(excludeDealId ? { id: { not: excludeDealId } } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    })

    if (!deal) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      deal: {
        title: deal.title,
        status: deal.status,
        date: deal.createdAt,
      },
    })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
