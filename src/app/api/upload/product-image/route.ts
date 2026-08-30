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
        { success: false, error: 'শুধুমাত্র সেলাররা ইমেজ আপলোড করতে পারেন' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ইমেজ ফাইল দিন' },
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
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
