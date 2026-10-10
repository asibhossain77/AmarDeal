import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/marketplace/provider  — provider settings (safe view)
   PUT /api/admin/marketplace/provider  — upsert provider settings

   ADMIN-ONLY. The provider API key is WRITE-ONLY: GET returns a
   boolean `hasKey`, never the secret itself. Stored in
   PlatformSetting alongside the other gateway credentials so it
   stays server-side at all times.
   ═══════════════════════════════════════════════════════════ */

const PROVIDER_KEYS = ['mp_provider_name', 'mp_provider_api_url', 'mp_provider_api_key', 'mp_provider_enabled'] as const

async function upsertSetting(key: string, value: string) {
  await db.platformSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const settings = await db.platformSetting.findMany({
      where: { key: { in: [...PROVIDER_KEYS] } },
    })
    const map = new Map(settings.map((s) => [s.key, s.value]))

    return NextResponse.json({
      success: true,
      provider: {
        name: map.get('mp_provider_name') || '',
        apiUrl: map.get('mp_provider_api_url') || '',
        hasKey: !!map.get('mp_provider_api_key'),
        enabled: map.get('mp_provider_enabled') === 'true',
      },
    })
  } catch (err) {
    console.error('[admin-mp-provider] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const b = body as Record<string, unknown>

    if (b.name !== undefined) {
      await upsertSetting('mp_provider_name', String(b.name).trim().slice(0, 100))
    }
    if (b.apiUrl !== undefined) {
      const url = String(b.apiUrl).trim().slice(0, 500)
      if (url) {
        try {
          const parsed = new URL(url)
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol')
        } catch {
          return NextResponse.json({ success: false, error: 'Invalid API URL' }, { status: 400 })
        }
      }
      await upsertSetting('mp_provider_api_url', url)
    }
    // The API key is only overwritten when a non-empty value is supplied
    if (b.apiKey !== undefined && String(b.apiKey).trim() !== '') {
      await upsertSetting('mp_provider_api_key', String(b.apiKey).trim().slice(0, 200))
    }
    if (b.enabled !== undefined) {
      await upsertSetting('mp_provider_enabled', b.enabled ? 'true' : 'false')
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin-mp-provider] PUT error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
