import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    // Admin auth via cookie
    const cookieStore = await cookies()
    const session = cookieStore.get('midman_session')?.value
    if (!session) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 })
    }
    const admin = await db.admin.findFirst({ where: { userId: session } })
    if (!admin) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 })
    }

    const deals = await db.deal.findMany({
      where: { adminCalled: true },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { adminCalledAt: 'desc' },
    })

    return NextResponse.json(deals)
  } catch {
    return NextResponse.json({ error: 'সমস্যা হয়েছে' }, { status: 500 })
  }
}