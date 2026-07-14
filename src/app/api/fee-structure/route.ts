import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rules = await db.feeRule.findMany({
      where: { is_active: true },
      orderBy: { minimum_amount: 'asc' },
    })
    return NextResponse.json(rules)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch fee structure' }, { status: 500 })
  }
}