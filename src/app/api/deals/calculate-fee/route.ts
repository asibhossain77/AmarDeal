import { NextResponse } from 'next/server'
import { calculateDealFee } from '@/lib/fee'

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

    // Single source of truth: free threshold -> tier rules -> percentage fallback
    const result = await calculateDealFee(amount)

    const total = amount + result.fee
    const feePercentage = amount > 0 ? ((result.fee / amount) * 100).toFixed(2) : '0.00'

    return NextResponse.json({
      amount,
      fee: result.fee,
      total,
      feePercentage: parseFloat(feePercentage),
      matchedRule: result.matchedRule,
      source: result.source,
      freeBelow: result.config.freeBelow,
      defaultFeePercent: result.config.feePercentage,
    })
  } catch {
    return NextResponse.json({ error: 'ফি হিসাব করতে ব্যর্থ' }, { status: 500 })
  }
}
