import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

const VALID_ACCOUNT_TYPES = ['bkash', 'nagad', 'rocket', 'bank']
const MAX_ACCOUNTS = 5

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return auth.response

    const accounts = await db.payoutAccount.findMany({
      where: { userId: auth.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ accounts })
  } catch {
    return NextResponse.json(
      { error: 'পেআউট অ্যাকাউন্ট লোড করতে সমস্যা' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { accountType, accountName, accountNumber, isDefault } = body

    if (!accountType || !accountName || !accountNumber) {
      return NextResponse.json(
        { error: 'সব তথ্য দিন', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
      return NextResponse.json(
        { error: 'অবৈধ অ্যাকাউন্ট টাইপ', code: 'INVALID_TYPE' },
        { status: 400 }
      )
    }

    // Max 5 accounts per user
    const count = await db.payoutAccount.count({
      where: { userId: auth.userId },
    })

    if (count >= MAX_ACCOUNTS) {
      return NextResponse.json(
        { error: 'সর্বোচ্চ ৫টি অ্যাকাউন্ট যোগ করতে পারবেন', code: 'MAX_ACCOUNTS' },
        { status: 400 }
      )
    }

    // If setting as default, unset others first
    if (isDefault) {
      await db.payoutAccount.updateMany({
        where: { userId: auth.userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const account = await db.payoutAccount.create({
      data: {
        userId: auth.userId,
        accountType,
        accountName,
        accountNumber,
        isDefault: isDefault === true,
      },
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'অ্যাকাউন্ট তৈরিতে সমস্যা' },
      { status: 500 }
    )
  }
}