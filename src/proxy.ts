import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

const SESSION_COOKIE = 'midman_session'

/**
 * Next.js 16 Proxy (formerly "Middleware") — runs on the Edge before any route handler.
 *
 * Responsibilities:
 *
 * 1. Rate Limiting (per-request):
 *    - In-memory fixed-window rate limiter with per-IP + per-category buckets.
 *    - Auth endpoints (login, register, password reset, 2FA): 5 req/min
 *    - Auth moderate (OTP, email check): 10 req/min
 *    - Sensitive (reviews, AI support, contact): 5 req/min
 *    - General API: 60 req/min
 *    - Page loads: 120 req/min
 *    - Returns 429 with Retry-After header when exceeded.
 *
 * 2. CSP Nonce (per-request):
 *    - Generate a cryptographically random nonce (UUID v4 via Web Crypto API).
 *    - Build a strict Content-Security-Policy with nonce + strict-dynamic.
 *    - Dev mode keeps 'unsafe-eval' for Turbopack HMR; production drops it.
 *    - style-src keeps 'unsafe-inline' (Tailwind + next-themes inject styles).
 *    - Pass nonce downstream via x-nonce header.
 *
 * 3. Admin auth gate:
 *    - Require the midman_session cookie on /api/admin/* routes
 *      (except 2FA login-verify which SETS the cookie).
 */

export const config = {
  // Run on everything except true static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|uploads|cdn/).*)',
  ],
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' wss: ws:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  if (!isDev) {
    directives.push("frame-ancestors 'none'")
  }
  return directives.join('; ')
}

/** Extract client IP from request (works behind Caddy/Nginx proxy) */
function getClientIp(req: NextRequest): string {
  // x-forwarded-for can contain multiple IPs; first one is the original client
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return req.ip ?? 'unknown'
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const method = req.method
  const ip = getClientIp(req)

  // --- 1. Rate limiting ---
  const rateResult = checkRateLimit(pathname, method, ip)
  if (!rateResult.allowed) {
    const retryAfterSec = Math.ceil(rateResult.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'অতিরিক্ত অনুরোধ, অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন', code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'Content-Security-Policy': buildCsp(crypto.randomUUID()),
        },
      },
    )
  }

  // --- 2. CSP nonce ---
  const nonce = crypto.randomUUID()
  const csp = buildCsp(nonce)

  // --- 3. Forward nonce to downstream server components ---
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  // --- 4. Admin auth gate ---
  const publicAdminRoutes = ['/api/admin/2fa/login-verify', '/api/admin/marketplace', '/api/admin/marketplace/banners']
  const isAdminRoute = pathname.startsWith('/api/admin/')
  const isPublicAdmin = publicAdminRoutes.some((r) => pathname.startsWith(r))

  if (isAdminRoute && !isPublicAdmin) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE)
    if (!sessionCookie?.value) {
      const res = NextResponse.json(
        { error: 'আনুষ্ঠানিকতা প্রয়োজন', code: 'NO_SESSION' },
        { status: 401 },
      )
      res.headers.set('Content-Security-Policy', csp)
      return res
    }
  }

  // --- 5. Continue ---
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)
  return response
}
