import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'midman_session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')

    if (!token || !email) {
      return NextResponse.redirect(new URL('/?magic=error', request.url))
    }

    // Find user by email + token
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user || user.resetToken !== token) {
      return NextResponse.redirect(new URL('/?magic=invalid', request.url))
    }

    if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
      return NextResponse.redirect(new URL('/?magic=expired', request.url))
    }

    // Invalidate token
    await db.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiry: null },
    })

    // Check if profile is complete (has name and phone)
    const profileComplete = !!(user.name && user.name.trim() && user.phone && user.phone.trim())

    // Build redirect URL
    const siteUrl = new URL('/', request.url)
    siteUrl.searchParams.set('magic', 'success')
    siteUrl.searchParams.set('uid', user.id)
    siteUrl.searchParams.set('complete', profileComplete ? 'true' : 'false')

    const response = NextResponse.redirect(siteUrl)

    if (profileComplete) {
      // Set session cookie directly
      response.cookies.set(SESSION_COOKIE, user.id, COOKIE_OPTIONS)
    }

    return response
  } catch (err) {
    console.error('[MAGIC LINK VERIFY] Error:', err)
    return NextResponse.redirect(new URL('/?magic=error', request.url))
  }
}
