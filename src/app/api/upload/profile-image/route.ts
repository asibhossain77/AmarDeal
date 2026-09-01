import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('midman_session')
    if (!session?.value) {
      return NextResponse.json({ error: 'আনুষ্ঠানিকতা প্রয়োজন' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const oldImage = formData.get('oldImage') as string | null

    if (!file) {
      return NextResponse.json({ error: 'ছবি প্রদান করুন' }, { status: 400 })
    }

    // Delete old image if re-uploading
    if (oldImage) {
      await deleteFromR2(oldImage)
    }

    const result = await uploadToR2(file, 'profiles')

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    console.error('[Upload] Profile image upload FAILED:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
