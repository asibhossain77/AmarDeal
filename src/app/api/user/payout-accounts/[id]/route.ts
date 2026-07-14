import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

const VALID_ACCOUNT_TYPES = ['bkash', 'nagad', 'rocket', 'bank']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return auth.response

    const { id } = await params

    const existing = await db.payoutAccount.findUnique({
      where: { id },
    })

    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json(
        { error: 'অ্যাকাউন্ট পাওয়া যায়নি', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { accountType, accountName, accountNumber, isDefault } = body

    // If setting as default, unset others first
    if (isDefault === true) {
      await db.payoutAccount.updateMany({
        where: { userId: auth.userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const updateData: Record<string, string | boolean> = {}
    if (accountType !== undefined) {
      if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
        return NextResponse.json(
          { error: 'অবৈধ অ্যাকাউন্ট টাইপ', code: 'INVALID_TYPE' },
          { status: 400 }
        )
      }
      updateData.accountType = accountType
    }
    if (accountName !== undefined) updateData.accountName = accountName
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber
    if (isDefault !== undefined) updateData.isDefault = isDefault

    const account = await db.payoutAccount.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ account })
  } catch {
    return NextResponse.json(
      { error: 'অ্যাকাউন্ট আপডেট করতে সমস্যা' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return auth.response

    const { id } = await params

    const existing = await db.payoutAccount.findUnique({
      where: { id },
    })

    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json(
        { error: 'অ্যাকাউন্ট পাওয়া যায়নি', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    await db.payoutAccount.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'অ্যাকাউন্ট মুছে ফেলতে সমস্যা' },
      { status: 500 }
    )
  }
}