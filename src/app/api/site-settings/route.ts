import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.platformSetting.findMany({
      where: { key: { in: ['platform_name', 'platform_name_en', 'site_logo', 'footer_description', 'footer_copyright_text', 'footer_made_in'] } },
    })

    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.key] = r.value
    }

    return NextResponse.json({
      siteName: map.platform_name || 'মিডম্যান',
      siteNameEn: map.platform_name_en || 'Midman',
      siteLogo: map.site_logo || '/logo.png',
      footerDescription: map.footer_description || '',
      footerCopyrightText: map.footer_copyright_text || '',
      footerMadeIn: map.footer_made_in || '',
    })
  } catch {
    return NextResponse.json(
      {
        siteName: 'মিডম্যান',
        siteNameEn: 'Midman',
        siteLogo: '/logo.png',
        footerDescription: '',
        footerCopyrightText: '',
        footerMadeIn: '',
      },
      { status: 200 }
    )
  }
}