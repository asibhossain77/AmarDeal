import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const identifier = req.nextUrl.searchParams.get('identifier')
    if (!identifier) {
      return NextResponse.json({ found: false }, { status: 400 })
    }

    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
      select: { id: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({ found: true, name: user.name, id: user.id })
  } catch {
    return NextResponse.json({ found: false }, { status: 500 })
  }
}