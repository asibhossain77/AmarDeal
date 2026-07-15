import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'amdeal_session'

/**
 * Next.js Proxy — runs on the Edge before any route handler.
 *
 * Protects /api/admin/* routes by checking for the presence of the
 * `amdeal_session` cookie.  If the cookie is missing, the request is
 * rejected immediately with a 401 JSON response.
 *
 * NOTE: The proxy can only verify that a session cookie EXISTS.
 * The actual "is this user an admin?" check (querying the `admins`
 * table) happens inside each admin route handler via `requireAdmin()`
 * in `src/lib/admin-guard.ts`, because the Edge Runtime cannot
 * directly access the database.
 */

export const config = {
  matcher: ['/api/admin/:path*'],
}

export async function proxy(req: NextRequest) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE)

  // No session cookie at all — reject immediately
  if (!sessionCookie?.value) {
    return NextResponse.json(
      { error: 'আনুষ্ঠানিকতা প্রয়োজন', code: 'NO_SESSION' },
      { status: 401 }
    )
  }

  // Session cookie exists — pass through to the route handler
  // where `requireAdmin()` will verify the user is in the admins table.
  return NextResponse.next()
}