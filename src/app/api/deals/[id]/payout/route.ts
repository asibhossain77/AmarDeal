import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params

    // Auth + ownership check
    const guard = await requireDealAccess(req, dealId)
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(req.url)
    const typeFilter = searchParams.get('type')

    const whereClause: Record<string, string> = { dealId }
    if (typeFilter) {
      whereClause.type = typeFilter
    }

    const payouts = await db.payout.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : { dealId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ payouts })
  } catch {
    return NextResponse.json(
      { error: 'পেআউট তথ্য লোড করতে সমস্যা' },
      { status: 500 }
    )
  }
}