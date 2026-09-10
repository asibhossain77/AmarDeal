import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const info = await db.contactInfo.findFirst();

    const settings = await db.platformSetting.findMany({
      where: { key: { in: ['admin_display_name', 'admin_image_url', 'contact_map_url'] } },
    });
    const settingMap: Record<string, string> = {};
    for (const s of settings) {
      settingMap[s.key] = s.value;
    }

    const base = {
      phone: null,
      email: null,
      whatsapp: null,
      telegram: null,
      facebook: null,
      facebookPage: null,
      facebookGroup: null,
      telegramGroup: null,
      address: null,
      mapUrl: settingMap['contact_map_url'] || '',
      adminName: settingMap['admin_display_name'] || '',
      adminImageUrl: settingMap['admin_image_url'] || '',
    };

    if (!info) return NextResponse.json(base);

    return NextResponse.json({
      ...info,
      mapUrl: settingMap['contact_map_url'] || '',
      adminName: settingMap['admin_display_name'] || '',
      adminImageUrl: settingMap['admin_image_url'] || '',
    });
  } catch {
    return NextResponse.json(
      { error: 'যোগাযোগ তথ্য লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    );
  }
}