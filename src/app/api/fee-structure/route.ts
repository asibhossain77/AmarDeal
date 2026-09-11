import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getFeeConfig } from '@/lib/fee'

export async function GET() {
  try {
    const [rules, config] = await Promise.all([
      db.feeRule.findMany({
        where: { is_active: true },
        orderBy: { minimum_amount: 'asc' },
      }),
      getFeeConfig(),
    ])
    return NextResponse.json({
      rules,
      freeBelow: config.freeBelow,
      defaultFeePercent: config.feePercentage,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch fee structure' }, { status: 500 })
  }
}
