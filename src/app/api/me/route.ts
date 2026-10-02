import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAllowedBridgeOrigins } from '@/lib/bridge-origins'

/**
 * GET /api/me — canonical identity endpoint for the midman.bd account system.
 *
 * Returns ONLY the authenticated user's public identity (id, name, email,
 * avatar). Never exposes passwords, session secrets or tokens.
 *
 * Same-origin callers (midman pages) work via the midman_session cookie.
 * Cross-subdomain callers (verify.midman.bd) get CORS credentialed access —
 * the origin is allowlisted (never reflected blindly). The current
 * midman_session cookie is host-only, so verify uses the signed bridge
 * handoff instead; /api/me becomes directly usable from verify the day the
 * cookie is widened to Domain=.midman.bd.
 *
 * Unauthenticated → 200 { "authenticated": false }
 */

const SESSION_COOKIE = 'midman_session'

function corsFor(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin) return {}
  // Allowlist check — never reflect an arbitrary origin with credentials.
  if (!getAllowedBridgeOrigins().includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

export async function GET(req: NextRequest) {
  const cors = corsFor(req)
  try {
    const sessionId = req.cookies.get(SESSION_COOKIE)?.value

    if (!sessionId) {
      return NextResponse.json({ authenticated: false }, { headers: cors })
    }

    const user = await db.user.findUnique({ where: { id: sessionId } })

    if (!user || !user.isActive) {
      // Expired/invalid session — report honestly, do not leak why.
      return NextResponse.json({ authenticated: false }, { headers: cors })
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.imageLink ?? null,
        },
      },
      { headers: cors },
    )
  } catch (err) {
    console.error('/api/me error:', err)
    return NextResponse.json({ authenticated: false }, { status: 500, headers: cors })
  }
}

export async function OPTIONS(req: NextRequest) {
  const cors = corsFor(req)
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...cors,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
