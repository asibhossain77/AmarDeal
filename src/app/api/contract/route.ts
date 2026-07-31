import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const settings = await db.platformSetting.findMany({
      where: {
        key: {
          in: ['contract_content', 'admin_display_name', 'admin_image_url'],
        },
      },
    });

    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return NextResponse.json({
      content: map['contract_content'] || '',
      adminName: map['admin_display_name'] || 'মিডম্যান অ্যাডমিন',
      adminImageUrl: map['admin_image_url'] || '',
    });
  } catch {
    return NextResponse.json(
      { error: 'সার্ভারে সমস্যা হয়েছে' },
      { status: 500 }
    );
  }
}