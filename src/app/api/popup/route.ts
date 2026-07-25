import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'popup_config' } });
    if (!row) return NextResponse.json({ enabled: false });
    const config = JSON.parse(row.value);
    // Only expose what the frontend needs (never expose admin-only metadata)
    return NextResponse.json({
      enabled: !!config.enabled,
      content: config.content || '',
      image: config.image || '',
      link: config.link || '',
      buttonTitle: config.buttonTitle || '',
    });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
