import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const methods = await db.paymentMethod.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(methods)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const body = await req.json()
    const { name, accountNumber, accountType, status, sortOrder, color, image } = body

    if (!name || !accountNumber) {
      return NextResponse.json(
        { error: 'নাম এবং অ্যাকাউন্ট নম্বর আবশ্যক' },
        { status: 400 }
      )
    }

    const method = await db.paymentMethod.create({
      data: {
        name,
        accountNumber,
        accountType: accountType || 'personal',
        status: status || 'active',
        sortOrder: sortOrder ?? 0,
        color: color || '#84CC16',
        ...(image && { image }),
      },
    })

    return NextResponse.json(method, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}