import { NextRequest, NextResponse } from 'next/server'
import { piprapayAppUrl } from '@/lib/piprapay'

/* ═══════════════════════════════════════════════════════════
   GET /api/marketplace/payment/cancel
   Pure redirect back to the app — the order stays unpaid and
   the customer can retry.
   ═══════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const appUrl = piprapayAppUrl() || req.nextUrl.origin
  try {
    return NextResponse.redirect(`${appUrl}/?mp_pay=cancel`, 302)
  } catch {
    return NextResponse.redirect(`${appUrl}/?mp_pay=error`, 302)
  }
}
