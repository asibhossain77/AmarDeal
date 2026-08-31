import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ছবি ফাইল দিন' },
        { status: 400 }
      )
    }

    console.error('[Upload] Profile image upload for user:', userId, 'file:', file.name, 'size:', file.size)

    const user = await db.user.findUnique({ where: { id: userId }, select: { imageLink: true } })
    console.error('[Upload] Current imageLink in DB:', user?.imageLink || 'null')
    if (user?.imageLink) {
      await deleteFromR2(user.imageLink)
    }

    const result = await uploadToR2(file, 'profiles')
    console.error('[Upload] R2 upload result URL:', result.url)

    const updated = await db.user.update({
      where: { id: userId },
      data: { imageLink: result.url },
    })
    console.error('[Upload] DB updated. New imageLink:', updated.imageLink)

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    console.error('[Upload] Profile image upload FAILED:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
