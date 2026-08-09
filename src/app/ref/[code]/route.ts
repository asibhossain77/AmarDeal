import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const REFERRAL_COOKIE_NAME = 'midman_ref'
const REFERRAL_COOKIE_DAYS = 30

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  // Build redirect response with explicit control over cookies
  const baseUrl = new URL(req.url).origin
  const response = NextResponse.redirect(`${baseUrl}/`)

  try {
    // Look up the referral code
    const referrer = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true, name: true },
    })

    if (referrer) {
      // Valid referral code — set cookie for 30 days
      response.cookies.set(REFERRAL_COOKIE_NAME, JSON.stringify({
        code,
        referrerId: referrer.id,
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
      })
      console.log(`[REFERRAL] Cookie set for code=${code}, referrerId=${referrer.id}`)
    } else {
      // Invalid code — clear any existing referral cookie
      response.cookies.delete(REFERRAL_COOKIE_NAME)
      console.log(`[REFERRAL] Invalid code=${code}, cookie cleared`)
    }
  } catch (err) {
    console.error('[REFERRAL ROUTE ERROR]', err)
  }

  return response
}
