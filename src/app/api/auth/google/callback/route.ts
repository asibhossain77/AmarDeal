import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''}/api/auth/google/callback`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''

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

async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
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
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.redirect(`${APP_URL}/?google_login=error&msg=not_configured`)
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      return NextResponse.redirect(`${APP_URL}/?google_login=error&msg=denied`)
    }

    // 1. Exchange code for tokens
    const tokens = await exchangeCode(code)

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
      // Generate a unique phone placeholder (will be updated later)
      const phoneSuffix = googleUser.email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 8)
      const randomDigits = Math.floor(10000 + Math.random() * 90000)
      const dummyPhone = `g_${phoneSuffix}${randomDigits}`

      user = await db.user.create({
        data: {
          name: googleUser.name || googleUser.email.split('@')[0],
          email: googleUser.email,
          phone: dummyPhone,
          password: await hashPassword(crypto.randomUUID()),
          googleId: googleUser.sub,
          emailVerified: googleUser.email_verified,
        },
        include: { admin: true },
      })
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

    // 4. Build response & set session cookie (same as /api/auth/login)
    const adminPermissions = user.admin?.permissions ? JSON.parse(user.admin.permissions) : []

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
