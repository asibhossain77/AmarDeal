/**
 * verify.midman.bd ↔ midman.bd authentication bridge — token signing/verification.
 *
 * Architecture: midman.bd is the ONLY account system. The bridge issues a
 * SHORT-LIVED (120 s), SINGLE-USE, HMAC-SHA256-signed token that tells
 * verify.midman.bd which existing Midman user is authenticated. Verify never
 * sees passwords, session cookies or any credential — only the public
 * identity fields (id, name, email, avatar).
 *
 * Token travels as a redirect query parameter over HTTPS, is consumed once
 * by verify's /auth/callback (jti persisted there for replay protection),
 * and expires in 120 s.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export const BRIDGE_AUD = 'verify-bridge'
export const BRIDGE_TOKEN_TTL_MS = 120_000 // 2 minutes, one-time use

export interface BridgeTokenPayload {
  /** Midman user id (cuid) — the single source of truth reference */
  sub: string
  name: string
  email: string
  avatar: string | null
  iat: number
  exp: number
  jti: string
  aud: typeof BRIDGE_AUD
}

function getSecret(): string | null {
  const s = process.env.VERIFY_BRIDGE_SECRET
  if (s && s.length >= 32) return s
  // Dev convenience default so local E2E works without env setup.
  // Production FAILS CLOSED: no secret → no tokens (bridge route returns 503).
  if (process.env.NODE_ENV !== 'production') {
    return 'dev-only-insecure-bridge-secret-change-me-in-production!'
  }
  return null
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function hmac(data: string): string {
  return b64url(createHmac('sha256', getSecret() as string).update(data).digest())
}

/** Issue a signed one-time bridge token for an authenticated Midman user. */
export function signBridgeToken(user: { id: string; name: string; email: string; imageLink?: string | null }): {
  token: string
  payload: BridgeTokenPayload
} {
  const now = Date.now()
  const payload: BridgeTokenPayload = {
    sub: user.id,
    name: user.name || '',
    email: user.email || '',
    avatar: user.imageLink ?? null,
    iat: now,
    exp: now + BRIDGE_TOKEN_TTL_MS,
    jti: randomBytes(16).toString('hex'),
    aud: BRIDGE_AUD,
  }
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return { token: `${body}.${hmac(body)}`, payload }
}

/**
 * Verify a bridge token: signature (constant-time), audience and expiry.
 * Returns the payload, or null when the token is invalid/expired/tampered.
 * Single-use (jti) is enforced by the CONSUMER (verify DB unique index).
 */
export function verifyBridgeToken(token: string): BridgeTokenPayload | null {
  if (typeof token !== 'string' || token.length > 8192 || !token.includes('.')) return null
  const dot = token.lastIndexOf('.')
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const expected = Buffer.from(hmac(body), 'base64url')
    const given = Buffer.from(sig, 'base64url')
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as BridgeTokenPayload
    if (payload.aud !== BRIDGE_AUD) return null
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    return payload
  } catch {
    return null
  }
}
