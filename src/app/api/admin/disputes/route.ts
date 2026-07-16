import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const deals = await db.deal.findMany({
      where: { status: 'disputed' },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(deals)
  } catch {
    return NextResponse.json(
      { error: 'বিরোধ তথ্য লোড করতে সমস্যা' },
      { status: 500 },
    )
  }
}