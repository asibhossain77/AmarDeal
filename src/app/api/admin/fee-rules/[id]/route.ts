import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { minimum_amount, maximum_amount, fee, is_active } = body

    const existing = await db.feeRule.findUnique({ where: { id: Number(id) } })
    if (!existing) {
      return NextResponse.json({ error: 'নিয়ম পাওয়া যায়নি' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (minimum_amount !== undefined) updateData.minimum_amount = Number(minimum_amount)
    if (maximum_amount !== undefined) updateData.maximum_amount = Number(maximum_amount)
    if (fee !== undefined) updateData.fee = Number(fee)
    if (is_active !== undefined) updateData.is_active = is_active

    const rule = await db.feeRule.update({
      where: { id: Number(id) },
      data: updateData,
    })

    return NextResponse.json(rule)
  } catch {
    return NextResponse.json({ error: 'আপডেট করতে ব্যর্থ' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.feeRule.delete({ where: { id: Number(id) } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'মুছে ফেলতে ব্যর্থ' }, { status: 500 })
  }
}