import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, accountNumber, accountType, status, sortOrder, color, image } = body

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
      },
    })

    return NextResponse.json(method)
  } catch (err) {
    console.error('PaymentMethod UPDATE error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.paymentMethod.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}