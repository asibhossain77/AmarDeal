import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

// default marketplace settings
const DEFAULT_SETTINGS = { enabled: true, title: '', subtitle: '' };

// GET - public endpoint, returns marketplace settings
export async function GET() {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'marketplace_settings' } });
    if (!row) return NextResponse.json(DEFAULT_SETTINGS);
    return NextResponse.json(JSON.parse(row.value));
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// PUT - admin only, saves marketplace settings
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { enabled, title, subtitle } = body;

    const settings = JSON.stringify({
      enabled: !!enabled,
      title: (title || '').trim(),
      subtitle: (subtitle || '').trim(),
    });

    await db.platformSetting.upsert({
      where: { key: 'marketplace_settings' },
      update: { value: settings, updatedAt: new Date() },
      create: { key: 'marketplace_settings', value: settings },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
