/**
 * ─────────────────────────────────────────────────────────────────
 * "Continue with Midman" — OAuth 2.0 provider core
 * ─────────────────────────────────────────────────────────────────
 *
 * Implements the minimal identity-only subset of OAuth 2.0 needed
 * by verify.midman.bd:
 *
 *   - scope handling (openid / profile / email only)
 *   - short-lived, single-use authorization codes (DB-backed,
 *     only SHA-256 hashes stored)
 *   - HMAC-signed consent tokens (CSRF protection on the consent
 *     form, bound to user + client + PKCE + redirect + expiry)
 *   - HMAC-signed short-lived bearer access tokens for /oauth/userinfo
 *
 * SECURITY INVARIANTS
 *   - Secrets/codes/tokens are NEVER logged.
 *   - Authorization codes are single-use (atomic DB consume).
 *   - Access tokens are opaque, HMAC-verified, 10-minute TTL.
 *   - All redirect URIs are exact allowlist matches upstream.
 */

import { db } from '@/lib/db'
import { b64url, b64urlDecodeString, hmacSign, randomToken, safeEqual, sha256Hex } from './crypto'

/* ── Tuning constants ── */

/** Authorization code TTL — deliberately short (single-use, 2 minutes) */
export const AUTH_CODE_TTL_S = 120
/** Access token TTL — identity claims only, short-lived */
export const ACCESS_TOKEN_TTL_S = 600
/** Consent form token TTL — protects the consent POST */
export const CONSENT_TOKEN_TTL_S = 300

export const ALLOWED_SCOPES = ['openid', 'profile', 'email'] as const

/* ── Signing secret ── */

/**
 * Provider signing secret (consent + access tokens).
 * Fails closed when unset — OAuth endpoints degrade to safe errors.
 */
export function getOauthSecret(): string | null {
  const secret = process.env.OAUTH_SECRET
  if (!secret || secret.length < 32) return null
  return secret
}

/* ── Scopes ── */

/**
 * Parse a space-separated scope string.
 * Returns null when scope is missing, empty, or not a subset of
 * ALLOWED_SCOPES (unknown scopes are rejected, not silently dropped).
 */
export function parseScope(raw: string | undefined | null): string[] | null {
  if (!raw || typeof raw !== 'string') return null
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const allowed = new Set<string>(ALLOWED_SCOPES)
  for (const p of parts) {
    if (!allowed.has(p)) return null
  }
  // stable order, deduped
  return ALLOWED_SCOPES.filter((s) => parts.includes(s))
}

/* ── Compact signed tokens ── */

interface TokenPayload {
  /** token type discriminator */
  t: 'consent' | 'access'
  /** subject (Midman user id) */
  sub: string
  /** client id */
  cid: string
  /** expiry (epoch seconds) */
  exp: number
  /** issued at (epoch seconds) */
  iat: number
}

export interface ConsentPayload extends TokenPayload {
  t: 'consent'
  /** redirect uri (exact) */
  rid: string
  /** scope list */
  sc: string[]
  /** PKCE code_challenge */
  chal: string
  /** PKCE method (always S256) */
  meth: string
  /** client state, echoed verbatim */
  st: string
}

export interface AccessPayload extends TokenPayload {
  t: 'access'
  /** scope list */
  sc: string[]
  /** unique token id */
  jti: string
}

function sign(payload: object, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = hmacSign(body, secret)
  return `${body}.${sig}`
}

function verify<T extends TokenPayload>(token: string, expectedType: 'consent' | 'access', secret: string): T | null {
  if (typeof token !== 'string' || token.length > 8192) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!safeEqual(sig, hmacSign(body, secret))) return null
  try {
    const parsed = JSON.parse(b64urlDecodeString(body)) as T
    if (parsed.t !== expectedType) return null
    if (typeof parsed.exp !== 'number' || parsed.exp * 1000 < Date.now()) return null
    if (typeof parsed.sub !== 'string' || !parsed.sub) return null
    return parsed
  } catch {
    return null
  }
}

/* ── Consent token (binds the consent form to user + request) ── */

export function issueConsentToken(p: {
  sub: string
  clientId: string
  redirectUri: string
  scope: string[]
  codeChallenge: string
  codeChallengeMethod: string
  state: string
}): string | null {
  const secret = getOauthSecret()
  if (!secret) return null
  const now = Math.floor(Date.now() / 1000)
  const payload: ConsentPayload = {
    t: 'consent',
    sub: p.sub,
    cid: p.clientId,
    rid: p.redirectUri,
    sc: p.scope,
    chal: p.codeChallenge,
    meth: p.codeChallengeMethod,
    st: p.state,
    iat: now,
    exp: now + CONSENT_TOKEN_TTL_S,
  }
  return sign(payload, secret)
}

export function verifyConsentToken(token: string): ConsentPayload | null {
  const secret = getOauthSecret()
  if (!secret) return null
  return verify<ConsentPayload>(token, 'consent', secret)
}

/* ── Access token (opaque bearer for /oauth/userinfo) ── */

export function issueAccessToken(p: { sub: string; scope: string[]; clientId: string }): string | null {
  const secret = getOauthSecret()
  if (!secret) return null
  const now = Math.floor(Date.now() / 1000)
  const payload: AccessPayload = {
    t: 'access',
    sub: p.sub,
    cid: p.clientId,
    sc: p.scope,
    jti: randomToken(16),
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_S,
  }
  return `mt_${sign(payload, secret)}`
}

export function verifyAccessToken(token: string): AccessPayload | null {
  const secret = getOauthSecret()
  if (!secret) return null
  if (typeof token !== 'string' || !token.startsWith('mt_')) return null
  return verify<AccessPayload>(token.slice(3), 'access', secret)
}

/* ── Authorization codes (DB-backed, single-use) ── */

export type ConsumeCodeResult =
  | { ok: true; row: { userId: string; clientId: string; redirectUri: string; scope: string; codeChallenge: string; codeChallengeMethod: string } }
  | { ok: false; reason: 'not_found' | 'used' | 'expired' | 'mismatch' }

/**
 * Create a single-use authorization code.
 * The raw code is returned exactly once; only its SHA-256 hash is
 * persisted. Expired codes older than 24h are garbage-collected
 * opportunistically.
 */
export async function createAuthorizationCode(p: {
  userId: string
  clientId: string
  redirectUri: string
  scope: string[]
  codeChallenge: string
  codeChallengeMethod: string
}): Promise<string> {
  const code = `mo_${randomToken(32)}`

  // Opportunistic GC of long-expired codes (keeps table tiny)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  db.oAuthAuthorizationCode
    .deleteMany({ where: { expiresAt: { lt: dayAgo } } })
    .catch(() => {})

  await db.oAuthAuthorizationCode.create({
    data: {
      codeHash: sha256Hex(code),
      clientId: p.clientId,
      userId: p.userId,
      redirectUri: p.redirectUri,
      scope: p.scope.join(' '),
      codeChallenge: p.codeChallenge,
      codeChallengeMethod: p.codeChallengeMethod,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_S * 1000),
    },
  })
  return code
}

/**
 * Atomically consume an authorization code.
 *
 * Order of operations (RFC 6749 §4.1.3 + RFC 7636 §4.6 hardening):
 *   1. Look up by hash → not_found when missing.
 *   2. Bindings must match (client + redirect_uri) — on mismatch the
 *      code is STILL burned so it cannot be probed with variations.
 *   3. Atomic single-use consume (`usedAt` null-guard) → used.
 *   4. Expiry check → expired.
 *
 * PKCE verification happens AFTER a successful consume in the token
 * route, so a stolen code cannot be brute-forced across retries.
 */
export async function consumeAuthorizationCode(p: {
  code: string
  clientId: string
  redirectUri: string | undefined
}): Promise<ConsumeCodeResult> {
  const codeHash = sha256Hex(p.code)

  const row = await db.oAuthAuthorizationCode.findUnique({ where: { codeHash } })
  if (!row) return { ok: false, reason: 'not_found' }

  if (row.clientId !== p.clientId || (p.redirectUri !== undefined && row.redirectUri !== p.redirectUri)) {
    // Burn the code even on binding mismatch — suspicious presentation.
    await db.oAuthAuthorizationCode
      .updateMany({ where: { codeHash, usedAt: null }, data: { usedAt: new Date() } })
      .catch(() => {})
    return { ok: false, reason: 'mismatch' }
  }

  // Atomic single-use claim
  const claimed = await db.oAuthAuthorizationCode.updateMany({
    where: { codeHash, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (claimed.count !== 1) return { ok: false, reason: 'used' }

  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    row: {
      userId: row.userId,
      clientId: row.clientId,
      redirectUri: row.redirectUri,
      scope: row.scope,
      codeChallenge: row.codeChallenge,
      codeChallengeMethod: row.codeChallengeMethod,
    },
  }
}

/* ── Redirect helpers ── */

/**
 * Append OAuth response params to a (already allowlisted) redirect URI.
 * Uses URLSearchParams so `state` is echoed verbatim and safely encoded.
 */
export function buildRedirectUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }
  return url.toString()
}

/**
 * Rebuild the /oauth/authorize query string from a verified consent
 * payload (used to send a stale-session user back through login).
 */
export function buildAuthorizeQuery(p: ConsentPayload): string {
  return new URLSearchParams({
    client_id: p.cid,
    redirect_uri: p.rid,
    response_type: 'code',
    scope: p.sc.join(' '),
    state: p.st,
    code_challenge: p.chal,
    code_challenge_method: p.meth,
  }).toString()
}

/**
 * Same-origin check for the consent POST (CSRF defense-in-depth on
 * top of SameSite=Lax cookies and the signed consent token).
 */
export function isSameOrigin(req: { headers: { get(name: string): string | null } }): boolean {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (!origin || !host) return false
  try {
    const originUrl = new URL(origin)
    if (originUrl.host !== host) return false
    // If the canonical app URL is configured, also require it to match
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      try {
        if (originUrl.host !== new URL(appUrl).host && !host.startsWith('localhost')) return false
      } catch {
        /* malformed app URL — ignore this check */
      }
    }
    return true
  } catch {
    return false
  }
}
