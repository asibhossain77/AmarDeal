import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

const PIPRAPAY_KEYS = ['piprapay_api_key', 'piprapay_base_url', 'piprapay_enabled']

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const { db } = await import('@/lib/db')
    const rows = await db.platformSetting.findMany({
      where: { key: { in: PIPRAPAY_KEYS } },
    })
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value

    return NextResponse.json({
      piprapay_api_key: map['piprapay_api_key'] || '',
      piprapay_base_url: map['piprapay_base_url'] || 'https://sandbox.piprapay.com',
      piprapay_enabled: map['piprapay_enabled'] || 'false',
    })
  } catch (err) {
    console.error('[ADMIN PIPRAPAY] GET error:', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const body = await req.json()
    const { piprapay_api_key, piprapay_base_url, piprapay_enabled } = body

    const { db } = await import('@/lib/db')

    // Upsert each setting
    const updates = [
      { key: 'piprapay_api_key', value: String(piprapay_api_key || '') },
      { key: 'piprapay_base_url', value: String(piprapay_base_url || 'https://sandbox.piprapay.com') },
      { key: 'piprapay_enabled', value: piprapay_enabled === true || piprapay_enabled === 'true' ? 'true' : 'false' },
    ]

    for (const u of updates) {
      await db.platformSetting.upsert({
        where: { key: u.key },
        create: { key: u.key, value: u.value },
        update: { value: u.value },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ADMIN PIPRAPAY] POST error:', err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
