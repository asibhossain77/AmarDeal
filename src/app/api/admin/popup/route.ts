import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-guard';

export async function GET() {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'popup_config' } });
    if (!row) return NextResponse.json({ enabled: false, content: '', image: '', link: '', buttonTitle: '' });
    return NextResponse.json(JSON.parse(row.value));
  } catch {
    return NextResponse.json({ enabled: false, content: '', image: '', link: '', buttonTitle: '' });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'অননুমোদিত' }, { status: 401 });

    const body = await req.json();
    const { enabled, content, image, link, buttonTitle } = body;

    const config = JSON.stringify({
      enabled: !!enabled,
      content: (content || '').trim(),
      image: (image || '').trim(),
      link: (link || '').trim(),
      buttonTitle: (buttonTitle || '').trim(),
    });

    await db.platformSetting.upsert({
      where: { key: 'popup_config' },
      update: { value: config, updatedAt: new Date() },
      create: { key: 'popup_config', value: config },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
