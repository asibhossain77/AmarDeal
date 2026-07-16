import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
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