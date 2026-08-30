import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('profile') as File | null

    if (!file) {
      return NextResponse.json({ error: 'প্রোফাইল ছবি প্রদান করুন' }, { status: 400 })
    }

    const old = await db.platformSetting.findUnique({ where: { key: 'admin_image_url' } })
    if (old?.value) {
      await deleteFromR2(old.value)
    }

    const result = await uploadToR2(file, 'profiles')

    await db.platformSetting.upsert({
      where: { key: 'admin_image_url' },
      update: { value: result.url },
      create: { key: 'admin_image_url', value: result.url },
    })

    return NextResponse.json({
      success: true,
      imageUrl: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'প্রোফাইল ছবি আপলোডে সমস্যা হয়েছে'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
