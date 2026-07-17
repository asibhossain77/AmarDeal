import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId দিন' }, { status: 400 })
    }

    const admin = await db.admin.findUnique({
      where: { userId },
      select: { totpEnabled: true },
    })

    if (!admin) {
      return NextResponse.json({ totpEnabled: false })
    }

    return NextResponse.json({ totpEnabled: admin.totpEnabled })
  } catch {
    return NextResponse.json({ totpEnabled: false })
  }
}