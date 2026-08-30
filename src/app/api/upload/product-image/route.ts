import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { uploadToR2 } from '@/lib/r2'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isSeller: true },
    })

    if (!user?.isSeller) {
      return NextResponse.json(
        { success: false, error: '\u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u09B8\u09C7\u09B2\u09BE\u09B0\u09B0\u09BE \u0987\u09AE\u09C7\u099C \u0986\u09AA\u09B2\u09CB\u09A1 \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u09A8' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: '\u0987\u09AE\u09C7\u099C \u09AB\u09BE\u0987\u09B2 \u09A6\u09BF\u09A8' },
        { status: 400 }
      )
    }

    const result = await uploadToR2(file, 'products')

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '\u0986\u09AA\u09B2\u09CB\u09A1\u09C7 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE \u09B9\u09DF\u09C7\u099B\u09C7'
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
