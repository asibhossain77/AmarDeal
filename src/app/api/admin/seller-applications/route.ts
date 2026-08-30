import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET() {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const applications = await db.sellerApplication.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, phone: true, imageLink: true, isSeller: true } } },
    })

    return NextResponse.json({ applications })
  } catch (err) {
    console.error('Get seller applications error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
