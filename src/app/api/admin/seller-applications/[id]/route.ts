import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = await req.json()
    const { status, rejectionReason } = body

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const application = await db.sellerApplication.findUnique({ where: { id } })
    if (!application) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (application.status !== 'pending') {
      return NextResponse.json({ error: 'Already processed' }, { status: 400 })
    }

    const updateData: Record<string, string> = { status }
    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason
    }

    await db.sellerApplication.update({
      where: { id },
      data: updateData,
    })

    if (status === 'approved') {
      await db.user.update({
        where: { id: application.userId },
        data: { isSeller: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update seller application error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
