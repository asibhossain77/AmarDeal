import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { db } = await import('@/lib/db')
    const rows = await db.platformSetting.findMany({
      where: { key: 'google_client_id' },
      select: { value: true },
    })
    const clientId = rows[0]?.value
    return NextResponse.json({ enabled: !!clientId })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}
