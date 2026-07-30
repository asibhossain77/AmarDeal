import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''
    const redirectUrl = `${appUrl}/?piprapay=cancel`

    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('[PIPRAPAY] Cancel redirect error:', err)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''
    return NextResponse.redirect(`${appUrl}/?piprapay=error`)
  }
}
