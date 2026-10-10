import { NextRequest, NextResponse } from 'next/server'
import { piprapayAppUrl } from '@/lib/piprapay'

/* ═══════════════════════════════════════════════════════════
   GET /api/marketplace/payment/success?pp_id=…
   Pure redirect (NO verification, NO db write — the redirect
   itself is untrusted). The SPA auto-verifies via
   POST /api/marketplace/payment/verify on ?mp_pay=success.
   ═══════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const appUrl = piprapayAppUrl() || req.nextUrl.origin
  const ppId = req.nextUrl.searchParams.get('pp_id') || ''
  try {
    const target = ppId
      ? `${appUrl}/?mp_pay=success&pp_id=${encodeURIComponent(ppId)}`
      : `${appUrl}/?mp_pay=error`
    return NextResponse.redirect(target, 302)
  } catch {
    return NextResponse.redirect(`${appUrl}/?mp_pay=error`, 302)
  }
}
