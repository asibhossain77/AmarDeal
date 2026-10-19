import type { NextRequest, NextResponse } from 'next/server'

export const SESSION_COOKIE = 'midman_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * Why not always SameSite=Lax?
 *
 * The app is routinely opened inside a third-party iframe (the chat
 * preview panel). Browsers block SameSite=Lax cookies in cross-site
 * iframe contexts — the login POST returns 200 but the Set-Cookie is
 * silently dropped, every authed API call afterwards 401s, and /admin
 * bounces back to /login even though the user just logged in.
 * Symptom in the server log: a successful POST /api/auth/login 200
 * immediately followed by 401s on /api/notifications etc.
 *
 * Fix: on https entry points (preview proxy / production) emit
 * `SameSite=None; Secure; Partitioned` (CHIPS). This works in BOTH
 * cross-site iframes and normal top-level tabs on Chrome/Edge/Firefox.
 * Plain-http localhost dev keeps Lax (browsers reject None-without-
 * Secure, and localhost http cannot be Secure).
 *
 * Host heuristic: if the request host is not loopback/private it must be
 * the public preview/production domain, which is always https at the
 * edge — so also emit the None+Secure+Partitioned form even if the
 * proxy did not forward x-forwarded-proto.
 */
function shouldPartitionCookie(req: NextRequest): boolean {
  const proto = (req.headers.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  const host = (
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    ''
  )
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '') // strip port

  if (proto === 'https') return true

  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host === ''
  const isPrivateLan =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)

  // Public domain (e.g. preview-*.space-z.ai) ⇒ served over https at the edge.
  return !isLoopback && !isPrivateLan
}

/**
 * Set the midman_session cookie on a login-family response with the
 * correct SameSite/Secure/Partitioned attributes for the request context.
 * Shared by: /api/auth/login, /api/admin/2fa/login-verify,
 * /api/auth/google/callback.
 */
export function setSessionCookie(
  response: NextResponse,
  req: NextRequest,
  userId: string,
  maxAge: number = SESSION_MAX_AGE
): void {
  const partitioned = shouldPartitionCookie(req)
  response.cookies.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    // Secure is mandatory for SameSite=None (browsers reject otherwise);
    // partitioned cookies are implicitly Secure-only as well.
    secure: partitioned || process.env.NODE_ENV === 'production',
    sameSite: partitioned ? 'none' : 'lax',
    path: '/',
    maxAge,
    ...(partitioned ? { partitioned: true } : {}),
  })
}
