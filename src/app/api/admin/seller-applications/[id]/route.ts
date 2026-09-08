import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { ensureVerificationColumn, withVerificationColumn } from '@/lib/seller-verify'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    await ensureVerificationColumn()

    const { id } = await params
    const body = await req.json()
    const { status, rejectionReason } = body

    const validStatuses = ['approved', 'rejected', 'disabled', 'enabled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const application = await withVerificationColumn(() =>
      db.sellerApplication.findUnique({ where: { id } })
    )
    if (!application) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // disabled/enabled can be toggled on approved or disabled applications
    // approved/rejected can only be set on pending applications
    if (['approved', 'rejected'].includes(status) && application.status !== 'pending') {
      return NextResponse.json({ error: 'Already processed' }, { status: 400 })
    }

    if (status === 'disabled' && application.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved sellers can be disabled' }, { status: 400 })
    }

    if (status === 'enabled' && application.status !== 'disabled') {
      return NextResponse.json({ error: 'Only disabled sellers can be re-enabled' }, { status: 400 })
    }

    const updateData: Record<string, string> = {}

    if (status === 'approved') {
      updateData.status = 'approved'
      if (rejectionReason) updateData.rejectionReason = rejectionReason
    } else if (status === 'rejected') {
      updateData.status = 'rejected'
      if (rejectionReason) updateData.rejectionReason = rejectionReason
    } else if (status === 'disabled') {
      updateData.status = 'disabled'
    } else if (status === 'enabled') {
      updateData.status = 'approved'
    }

    await db.sellerApplication.update({
      where: { id },
      data: updateData,
    })

    if (status === 'approved') {
      await db.user.update({
        where: { id: application.userId },
        data: { isSeller: true, whatsappNumber: application.whatsappNumber || null },
      })
    } else if (status === 'disabled') {
      await db.user.update({
        where: { id: application.userId },
        data: { isSeller: false },
      })
    } else if (status === 'enabled') {
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
