import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { deleteFromR2 } from '@/lib/r2'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(request)
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = await request.json()
    const { name, accountNumber, accountType, status, sortOrder, color, image, instructions, qrImage } = body

    const existing = await db.paymentMethod.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    const method = await db.paymentMethod.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(accountNumber !== undefined && { accountNumber }),
        ...(accountType !== undefined && { accountType }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(color !== undefined && { color }),
        ...(image !== undefined && { image: image || null }),
        ...(instructions !== undefined && { instructions: instructions || null }),
        ...(qrImage !== undefined && { qrImage: qrImage || null }),
      },
    })

    // Replace/remove: delete the old files from R2 (only when actually changed)
    if (image !== undefined && existing.image && existing.image !== (image || null)) {
      await deleteFromR2(existing.image).catch(() => {})
    }
    if (qrImage !== undefined && existing.qrImage && existing.qrImage !== (qrImage || null)) {
      await deleteFromR2(existing.qrImage).catch(() => {})
    }

    return NextResponse.json(method)
  } catch (err) {
    console.error('PaymentMethod UPDATE error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(request)
    if (!guard.ok) return guard.response

    const { id } = await params
    const existing = await db.paymentMethod.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    // Remove logo + QR image from R2 before deleting the record
    if (existing.image) await deleteFromR2(existing.image).catch(() => {})
    if (existing.qrImage) await deleteFromR2(existing.qrImage).catch(() => {})

    await db.paymentMethod.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
