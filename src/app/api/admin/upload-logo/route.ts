import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Logo file required' }, { status: 400 })
    }

    const old = await db.platformSetting.findUnique({ where: { key: 'site_logo' } })
    if (old?.value) {
      await deleteFromR2(old.value)
    }

    const result = await uploadToR2(file, 'logos')

    await db.platformSetting.upsert({
      where: { key: 'site_logo' },
      update: { value: result.url },
      create: { key: 'site_logo', value: result.url },
    })

    return NextResponse.json({
      success: true,
      logoPath: result.url,
      message: 'Logo updated successfully',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Logo upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
