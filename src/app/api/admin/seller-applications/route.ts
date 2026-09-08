import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { ensureVerificationColumn, withVerificationColumn } from '@/lib/seller-verify'

export async function GET() {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    await ensureVerificationColumn()

    const applications = await withVerificationColumn(() =>
      db.sellerApplication.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, phone: true, imageLink: true, isSeller: true, whatsappNumber: true } } },
      })
    )

    return NextResponse.json({ applications })
  } catch (err) {
    console.error('Get seller applications error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
