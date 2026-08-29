import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: '\u0987\u0989\u099C\u09BE\u09B0 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF' }, { status: 404 })
    }

    if (user.isSeller) {
      return NextResponse.json({ error: '\u0986\u09AA\u09A8\u09BF \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u098F\u0995\u099C\u09A8 \u09B8\u09C7\u09B2\u09BE\u09B0' }, { status: 400 })
    }

    await db.user.update({
      where: { id: userId },
      data: { isSeller: true },
    })

    return NextResponse.json({ success: true, isSeller: true })
  } catch (err) {
    console.error('Become seller error:', err)
    return NextResponse.json({ error: '\u09B8\u09AE\u09B8\u09CD\u09AF\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7' }, { status: 500 })
  }
}
