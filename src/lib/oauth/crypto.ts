/**
 * ─────────────────────────────────────────────────────────────────
 * OAuth provider crypto primitives (server-only)
 * ─────────────────────────────────────────────────────────────────
 *
 * Small, audited helpers used by the "Continue with Midman" provider:
 *  - base64url encoding (RFC 4648 §5, no padding)
 *  - HMAC-SHA256 signed compact tokens (consent + access tokens)
 *  - constant-time string comparison
 *  - PKCE S256 (RFC 7636)
 *
 * No secrets or tokens produced here are ever logged by callers.
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto'

/* ── base64url (RFC 4648 §5, unpadded) ── */

export function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function b64urlEncodeString(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

export function b64urlDecodeString(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

/* ── HMAC signing ── */

/** HMAC-SHA256 of `data` with `secret`, returned as base64url. */
export function hmacSign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('base64url')
}

/* ── Constant-time comparison ── */

/**
 * Compare two strings without leaking where they differ.
 * Both sides are hashed first so comparison length is fixed,
 * avoiding length-based early exits.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

/* ── Random tokens ── */

/** Cryptographically random base64url token (`bytes` entropy bytes). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/* ── Hashing ── */

/** SHA-256 hex digest — used to store authorization codes at rest. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/* ── PKCE (RFC 7636) ── */

/** code_verifier charset per RFC 7636 §4.1, length 43–128 */
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/

/** code_challenge charset (base64url), length 43–128 */
const CHALLENGE_RE = /^[A-Za-z0-9\-_]{43,128}$/

export function isValidPkceVerifier(verifier: string): boolean {
  return VERIFIER_RE.test(verifier)
}

export function isValidPkceChallenge(challenge: string): boolean {
  return CHALLENGE_RE.test(challenge)
}

/** S256: BASE64URL(SHA256(ASCII(code_verifier))) */
export function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

/** Verify a PKCE S256 pair in constant time. */
export function verifyPkceS256(verifier: string, storedChallenge: string): boolean {
  if (!isValidPkceVerifier(verifier)) return false
  if (!isValidPkceChallenge(storedChallenge)) return false
  return safeEqual(pkceS256(verifier), storedChallenge)
}
