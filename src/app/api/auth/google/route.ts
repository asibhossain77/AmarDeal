import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Read credentials from DB (admin panel managed)
    const rows = await db.platformSetting.findMany({
      where: { key: { in: ['google_client_id', 'google_redirect_url'] } },
    })
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value

    const clientId = map['google_client_id']
    const redirectUri = map['google_redirect_url'] || `${process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''}/api/auth/google/callback`

    if (!clientId) {
      return NextResponse.json({ error: 'Google login is not configured' }, { status: 503 })
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    })

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  } catch (err) {
    console.error('[Google OAuth Init]', err)
    return NextResponse.json({ error: 'Google login is not configured' }, { status: 503 })
  }
}
