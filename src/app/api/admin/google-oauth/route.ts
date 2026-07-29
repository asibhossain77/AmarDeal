import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

const GOOGLE_OAUTH_KEYS = [
  'google_client_id',
  'google_client_secret',
  'google_redirect_url',
] as const;

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const rows = await db.platformSetting.findMany({
      where: { key: { in: [...GOOGLE_OAUTH_KEYS] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return NextResponse.json({
      google_client_id: map['google_client_id'] || '',
      google_client_secret: map['google_client_secret'] || '',
      google_redirect_url: map['google_redirect_url'] || '',
      is_configured: !!(map['google_client_id'] && map['google_client_secret'] && map['google_redirect_url']),
    });
  } catch {
    return NextResponse.json(
      { error: 'Google OAuth সেটিংস লোড করতে সমস্যা' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();

    for (const key of GOOGLE_OAUTH_KEYS) {
      if (body[key] !== undefined && typeof body[key] === 'string') {
        await db.platformSetting.upsert({
          where: { key },
          create: { key, value: body[key] },
          update: { value: body[key] },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[GOOGLE OAUTH SETTINGS SAVE ERROR]', err);
    return NextResponse.json(
      { error: 'Google OAuth সেটিংস সেভ করতে সমস্যা' },
      { status: 500 },
    );
  }
}
