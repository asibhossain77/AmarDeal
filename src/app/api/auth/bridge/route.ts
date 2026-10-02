import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { isAllowedBridgeOrigin } from '@/lib/bridge-origins'
import { signBridgeToken } from '@/lib/bridge'

/**
 * GET /api/auth/bridge — SSO handoff to verify.midman.bd (and other trusted
 * subdomains). midman.bd remains the ONLY account system; this endpoint
 * never creates, modifies or authenticates anything by itself — it merely
 * asserts, with a signed one-time token, which EXISTING Midman user holds
 * the current midman_session cookie.
 *
 * Flow:
 *   1. verify.midman.bd sends the user here:
 *        /api/auth/bridge?redirect=https://verify.midman.bd/auth/callback&state=<csrf>
 *   2. Valid session  → 302 to <redirect>?bridge_token=<signed JWT-style>&state=<echoed>
 *      (token: HMAC-SHA256, aud=verify-bridge, 120 s TTL, single-use jti)
 *   3. No session     → 302 to /login?next=<this bridge URL> — after the
 *      EXISTING midman login the user is sent back here automatically
 *      (minimal, validated ?next= support was added to the login page).
 *
 * Security:
 *   - redirect origin must be EXACTLY in the allowlist (open-redirect guard)
 *   - token never contains credentials — only public identity fields
 *   - production without VERIFY_BRIDGE_SECRET fails CLOSED (503)
 *   - replay is neutralised on the consumer side (verify persists the jti)
 */

const SESSION_COOKIE = 'midman_session'

async function loadSessionUser(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return null
  const user = await db.user.findUnique({ where: { id: sessionId } })
  if (!user || !user.isActive) return null
  return user
}

export async function GET(req: NextRequest) {
  const redirectParam = req.nextUrl.searchParams.get('redirect')
  const state = req.nextUrl.searchParams.get('state')

  /* ── Open-redirect guard: strict origin allowlist, no exceptions ── */
  if (!redirectParam || !isAllowedBridgeOrigin(redirectParam)) {
    return NextResponse.json({ error: 'INVALID_REDIRECT' }, { status: 400 })
  }

  /* ── Production fail-closed when the signing secret is missing ── */
  if (process.env.NODE_ENV === 'production' && (process.env.VERIFY_BRIDGE_SECRET ?? '').length < 32) {
    console.error('[bridge] VERIFY_BRIDGE_SECRET missing/short in production — refusing to issue tokens')
    return NextResponse.json({ error: 'BRIDGE_NOT_CONFIGURED' }, { status: 503 })
  }

  /* ── Session check (the EXISTING midman_session cookie, unchanged) ── */
  let user
  try {
    user = await loadSessionUser(req)
  } catch (err) {
    console.error('[bridge] session lookup failed:', err)
    return NextResponse.json({ error: 'BRIDGE_ERROR' }, { status: 500 })
  }

  const callbackUrl = new URL(redirectParam)

  if (!user) {
    // Not logged in (or expired) → existing Midman login page, then back here.
    const loginUrl = new URL('/login', req.nextUrl.origin)
    loginUrl.searchParams.set('next', req.nextUrl.toString())
    return NextResponse.redirect(loginUrl.toString(), 302)
  }

  /* ── Issue the one-time signed handoff token ── */
  const { token } = signBridgeToken(user)
  callbackUrl.searchParams.set('bridge_token', token)
  if (state) callbackUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(callbackUrl.toString(), 302)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.headers.set('Referrer-Policy', 'no-referrer') // don't leak the token via Referer
  return response
}
