import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Logo file required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Logo max 2MB' }, { status: 400 })
    }

    // Convert to base64 data URL — works on Vercel (no filesystem write needed)
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // Save to database
    await db.platformSetting.upsert({
      where: { key: 'site_logo' },
      update: { value: dataUrl },
      create: { key: 'site_logo', value: dataUrl },
    })

    return NextResponse.json({
      success: true,
      logoPath: dataUrl,
      message: 'Logo updated successfully',
    })
  } catch {
    return NextResponse.json(
      { error: 'Logo upload failed' },
      { status: 500 }
    )
  }
}
