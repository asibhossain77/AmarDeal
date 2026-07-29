import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.platformSetting.findMany({
      where: { key: { in: ['google_client_id', 'google_redirect_url'] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const enabled = !!(map['google_client_id'] && map['google_redirect_url']);
    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
