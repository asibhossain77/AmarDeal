import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ppId = searchParams.get('pp_id') || ''

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''
    const redirectUrl = `${appUrl}/?piprapay=success&pp_id=${encodeURIComponent(ppId)}`

    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('[PIPRAPAY] Success redirect error:', err)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''
    return NextResponse.redirect(`${appUrl}/?piprapay=error`)
  }
}
