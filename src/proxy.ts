import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'amdeal_session'

/**
 * Next.js 16 Proxy (formerly "Middleware") — runs on the Edge before any route handler.
 *
 * Responsibilities:
 *
 * 1. CSP Nonce (per-request):
 *    - Generate a cryptographically random nonce (UUID v4 via Web Crypto API).
 *    - Build a strict Content-Security-Policy that allows inline <script> tags
 *      ONLY when they carry `nonce="{nonce}"`, plus 'strict-dynamic' (CSP3)
 *      so scripts loaded by trusted scripts (e.g. gtag.js pulling in GA) are
 *      also trusted. 'self' + googletagmanager.com are CSP2-browser fallbacks.
 *    - Dev mode keeps 'unsafe-eval' for Turbopack HMR; production drops it.
 *    - style-src keeps 'unsafe-inline' (Tailwind + next-themes inject styles).
 *    - Pass the nonce downstream to server components via the `x-nonce` request
 *      header so ThemeProvider / GoogleAnalytics can stamp it on inline scripts.
 *    - Next.js itself also reads `x-nonce` and applies it to its own inline
 *      bootstrap / hydration scripts automatically.
 *
 * 2. Admin auth gate:
 *    - Require the `amdeal_session` cookie on /api/admin/* routes (except the
 *      2FA login-verify route which SETS the cookie). The actual "is this user
 *      an admin?" DB check happens inside each route handler via requireAdmin()
 *      because the Edge Runtime cannot access the database.
 */

export const config = {
  // Run on everything except true static assets (which never need CSP or auth).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|uploads).*)',
  ],
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const directives: string[] = [
    "default-src 'self'",
    // nonce + strict-dynamic (CSP3). 'self' + GTM domain are CSP2-browser fallbacks.
    // Dev keeps 'unsafe-eval' for Turbopack HMR; prod drops it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ''}`,
    // Tailwind + next-themes inject styles at runtime — unsafe-inline is low risk.
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

export async function proxy(req: NextRequest) {
  // --- 1. Per-request nonce (Web Crypto `crypto` is a global in Edge Runtime) ---
  const nonce = crypto.randomUUID()

  // --- 2. Build CSP ---
  const csp = buildCsp(nonce)

  // --- 3. Forward nonce to downstream server components via request header ---
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  // --- 4. Admin auth gate (preserve existing behaviour) ---
  const pathname = req.nextUrl.pathname
  const publicAdminRoutes = ['/api/admin/2fa/login-verify']
  const isAdminRoute = pathname.startsWith('/api/admin/')
  const isPublicAdmin = publicAdminRoutes.some((r) => pathname.startsWith(r))

  if (isAdminRoute && !isPublicAdmin) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE)
    if (!sessionCookie?.value) {
      const res = NextResponse.json(
        { error: 'আনুষ্ঠানিকতা প্রয়োজন', code: 'NO_SESSION' },
        { status: 401 }
      )
      res.headers.set('Content-Security-Policy', csp)
      return res
    }
  }

  // --- 5. Continue — set CSP + forward modified request headers ---
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)
  return response
}
