import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PAYMENT_ICONS_SETTING_KEY, parseGatewayList } from '@/lib/payment-gateways'

export async function GET() {
  try {
    const rows = await db.platformSetting.findMany({
      where: { key: { in: ['platform_name', 'platform_name_en', 'site_title', 'site_logo', 'site_logo_light', 'site_logo_dark', 'footer_description', 'footer_copyright_text', 'footer_made_in', PAYMENT_ICONS_SETTING_KEY] } },
    })

    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.key] = r.value
    }

    return NextResponse.json({
      siteName: map.platform_name || 'মিডম্যান',
      siteNameEn: map.platform_name_en || 'Midman',
      siteTitle: map.site_title || '',
      siteLogo: (map.site_logo && map.site_logo !== '/logo.png') ? map.site_logo : '/logo.svg',
      // Admin-managed brand logos (light/dark variants). null ⇒ MidmanLogo
      // falls back to the bundled /brand/midman-*.svg defaults, so the site
      // works normally before the admin uploads anything.
      logoLight: map.site_logo_light || null,
      logoDark: map.site_logo_dark || null,
      footerDescription: map.footer_description || '',
      footerCopyrightText: map.footer_copyright_text || '',
      footerMadeIn: map.footer_made_in || '',
      paymentGateways: parseGatewayList(map[PAYMENT_ICONS_SETTING_KEY]),
    }, {
      // Never cached anywhere — admin logo/settings changes must reach every
      // browser on the very next request (was missing: browsers/proxies could
      // serve stale JSON, so visitors kept seeing the default logo).
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    })
  } catch {
    return NextResponse.json(
      {
        siteName: 'মিডম্যান',
        siteNameEn: 'Midman',
        siteTitle: '',
        siteLogo: '/logo.svg',
        logoLight: null,
        logoDark: null,
        footerDescription: '',
        footerCopyrightText: '',
        footerMadeIn: '',
        paymentGateways: parseGatewayList(null),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store, must-revalidate' } }
    )
  }
}
