import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const amountParam = searchParams.get('amount')

    if (!amountParam) {
      return NextResponse.json({ error: 'পরিমাণ প্রদান করুন' }, { status: 400 })
    }

    const amount = parseFloat(amountParam)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'সঠিক পরিমাণ প্রদান করুন' }, { status: 400 })
    }

    // Find the matching fee rule for this amount
    const rules = await db.feeRule.findMany({
      where: { is_active: true },
      orderBy: { minimum_amount: 'asc' },
    })

    let fee = 0
    let matchedRule = null

    for (const rule of rules) {
      if (amount >= rule.minimum_amount) {
        if (rule.maximum_amount === 0 || amount <= rule.maximum_amount) {
          fee = rule.fee
          matchedRule = {
            minimum_amount: rule.minimum_amount,
            maximum_amount: rule.maximum_amount,
            fee: rule.fee,
          }
          break
        }
      }
    }

    // If no rule matched, use a fallback (no fee)
    const total = amount + fee
    const feePercentage = amount > 0 ? ((fee / amount) * 100).toFixed(2) : '0.00'

    return NextResponse.json({
      amount,
      fee,
      total,
      feePercentage: parseFloat(feePercentage),
      matchedRule,
    })
  } catch {
    return NextResponse.json({ error: 'ফি হিসাব করতে ব্যর্থ' }, { status: 500 })
  }
}