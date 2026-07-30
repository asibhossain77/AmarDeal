import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { db } = await import('@/lib/db')
    const rows = await db.platformSetting.findMany({
      where: { key: { in: ['piprapay_api_key', 'piprapay_enabled'] } },
      select: { key: true, value: true },
    })
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    const enabled = map['piprapay_enabled'] === 'true' && !!map['piprapay_api_key']
    return NextResponse.json({ enabled })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}
