import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const oldImage = formData.get('oldImage') as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'ছবি ফাইল দিন' }, { status: 400 })
    }

    // Delete old banner image from R2 if replacing
    if (oldImage) {
      await deleteFromR2(oldImage)
    }

    const result = await uploadToR2(file, 'banners')

    return NextResponse.json({ success: true, url: result.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
