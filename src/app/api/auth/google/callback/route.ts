import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { hashPassword } from '@/lib/password'
import { generateUniqueReferralCode } from '@/lib/referral-code'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''
const REFERRAL_COOKIE_NAME = 'midman_ref'

interface GoogleTokenResponse {
  access_token: string
  id_token: string
}

interface GoogleUserInfo {
  sub: string
  email: string
  name?: string
  picture?: string
  email_verified: boolean
}

async function getGoogleCredentials() {
  const rows = await db.platformSetting.findMany({
    where: { key: { in: ['google_client_id', 'google_client_secret', 'google_redirect_url'] } },
  })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    clientId: map['google_client_id'] || '',
    clientSecret: map['google_client_secret'] || '',
    redirectUri: map['google_redirect_url'] || `${process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''}/api/auth/google/callback`,
  }
}

async function exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error('Token exchange failed')
  return res.json()
}

async function getGoogleUser(idToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken)
  if (!res.ok) throw new Error('Failed to get user info')
  return res.json()
}

export async function GET(req: NextRequest) {
  try {
    const { clientId, clientSecret, redirectUri } = await getGoogleCredentials()

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${APP_URL}/?google_login=error&msg=not_configured`)
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      return NextResponse.redirect(`${APP_URL}/?google_login=error&msg=denied`)
    }

    // 1. Exchange code for tokens
    const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri)

    // 2. Get user info from Google
    const googleUser = await getGoogleUser(tokens.id_token)

    if (!googleUser.email) {
      return NextResponse.redirect(`${APP_URL}/?google_login=error&msg=no_email`)
    }

    // 3. Find existing user by googleId or email
    let user = await db.user.findUnique({
      where: { email: googleUser.email },
      include: { admin: true },
    })

    if (!user) {
      // Create new user from Google data
      const phoneSuffix = googleUser.email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 8)
      const randomDigits = Math.floor(10000 + Math.random() * 90000)
      const dummyPhone = `g_${phoneSuffix}${randomDigits}`
      const referralCode = await generateUniqueReferralCode(googleUser.name || googleUser.email.split('@')[0])

      // Check referral cookie for new Google users
      let referredBy: string | undefined
      try {
        const cookieStore = await cookies()
        const refCookie = cookieStore.get(REFERRAL_COOKIE_NAME)
        if (refCookie?.value) {
          const parsed = JSON.parse(refCookie.value)
          if (parsed?.referrerId) {
            const referrer = await db.user.findUnique({
              where: { id: parsed.referrerId },
              select: { id: true, referralCode: true, isActive: true },
            })
            if (referrer?.isActive && referrer.referralCode === parsed.code) {
              referredBy = referrer.id
            }
          }
        }
      } catch {
        // Skip referral linking on error
      }

      user = await db.user.create({
        data: {
          name: googleUser.name || googleUser.email.split('@')[0],
          email: googleUser.email,
          phone: dummyPhone,
          password: await hashPassword(crypto.randomUUID()),
          googleId: googleUser.sub,
          emailVerified: googleUser.email_verified,
          referralCode,
          ...(referredBy ? { referredBy } : {}),
        },
        include: { admin: true },
      })

      // Clear referral cookie after successful registration
      if (referredBy) {
        try {
          const cookieStore = await cookies()
          cookieStore.delete(REFERRAL_COOKIE_NAME)
        } catch { /* ignore */ }
      }
    } else {
      // Link Google account if not already linked
      if (!user.googleId) {
        await db.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.sub },
        })
      }
    }

    if (!user.isActive) {
      return NextResponse.redirect(`${APP_URL}/?google_login=error&msg=account_disabled`)
    }

    // 4. Set session cookie and redirect
    const response = NextResponse.redirect(`${APP_URL}/?google_login=success`)

    response.cookies.set('amdeal_session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (err) {
    console.error('[Google OAuth]', err)
    return NextResponse.redirect(`${APP_URL}/?google_login=error&msg=server_error`)
  }
}
