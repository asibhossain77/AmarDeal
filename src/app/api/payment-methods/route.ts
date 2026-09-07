import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public endpoint: returns only active payment methods
export async function GET() {
  try {
    const methods = await db.paymentMethod.findMany({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        accountNumber: true,
        accountType: true,
        status: true,
        color: true,
        image: true,
        instructions: true,
        qrImage: true,
      },
    })
    return NextResponse.json(methods)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}