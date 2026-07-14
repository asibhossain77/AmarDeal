import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rules = await db.feeRule.findMany({
      orderBy: { minimum_amount: 'asc' },
    })
    return NextResponse.json(rules)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch fee rules' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { minimum_amount, maximum_amount, fee, is_active } = body

    if (minimum_amount === undefined || fee === undefined) {
      return NextResponse.json(
        { error: 'সর্বনিম্ন পরিমাণ এবং ফি আবশ্যক' },
        { status: 400 }
      )
    }

    if (minimum_amount < 0 || maximum_amount < 0 || fee < 0) {
      return NextResponse.json(
        { error: 'নেগেটিভ মান গ্রহণযোগ্য নয়' },
        { status: 400 }
      )
    }

    if (maximum_amount !== 0 && maximum_amount <= minimum_amount) {
      return NextResponse.json(
        { error: 'সর্বোচ্চ পরিমাণ সর্বনিম্ন পরিমাণের চেয়ে বড় হতে হবে' },
        { status: 400 }
      )
    }

    const rule = await db.feeRule.create({
      data: {
        minimum_amount: Number(minimum_amount),
        maximum_amount: Number(maximum_amount) || 0,
        fee: Number(fee),
        is_active: is_active !== undefined ? is_active : true,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'ফি নিয়ম তৈরি করতে ব্যর্থ' }, { status: 500 })
  }
}