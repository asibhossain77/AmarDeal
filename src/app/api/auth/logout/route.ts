import { NextRequest, NextResponse } from 'next/server'
import { isAllowedBridgeOrigin } from '@/lib/bridge-origins'

const SESSION_COOKIE = 'midman_session'

function clearedCookieResponse() {
  const response = NextResponse.json({ success: true })

  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // immediately expire
  })

  return response
}

export async function POST() {
  return clearedCookieResponse()
}

/**
 * GET /api/auth/logout?redirect=<allowlisted origin or path>
 *
 * Navigation-friendly logout used by trusted subdomains (verify.midman.bd):
 * clears the midman_session cookie, then sends the user back to an
 * allowlisted destination. Open-redirect guard: only exact allowlisted
 * origins or same-origin relative paths are honoured; anything else gets
 * the plain JSON response without a redirect.
 */
export async function GET(req: NextRequest) {
  const redirectParam = req.nextUrl.searchParams.get('redirect')

  let destination: string | null = null
  if (redirectParam) {
    if (redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      destination = new URL(redirectParam, req.nextUrl.origin).toString()
    } else if (isAllowedBridgeOrigin(redirectParam)) {
      destination = redirectParam
    }
  }

  if (!destination) return clearedCookieResponse()

  const response = NextResponse.redirect(destination, 302)
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}
