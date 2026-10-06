/**
 * ─────────────────────────────────────────────────────────────────
 * Post-login return-to support for the "Continue with Midman" flow
 * ─────────────────────────────────────────────────────────────────
 *
 * When an unauthenticated user lands on /oauth/authorize, the page
 * bounces them to the EXISTING Midman login page:
 *
 *     /login?next=/oauth/authorize?client_id=...
 *
 * The `next` param is stashed in sessionStorage by the app shell on
 * mount (survives Google / magic-link redirects inside the same
 * tab). After ANY successful login (password, 2FA, Google, magic),
 * the shell/auth view consumes it and navigates back to the
 * authorization screen.
 *
 * Open-redirect hardening: only same-origin /oauth/authorize paths
 * are accepted, and only after a strict format check.
 */

const KEY = 'midman_oauth_return_to'

/**
 * Strict validation for a post-login return-to path.
 * MUST be a same-origin path under /oauth/authorize — never an
 * absolute URL, protocol-relative URL, or encoded traversal.
 */
export function isValidReturnTo(path: unknown): path is string {
  if (typeof path !== 'string') return false
  if (path.length === 0 || path.length > 2048) return false
  if (!path.startsWith('/oauth/authorize')) return false
  if (path.includes('\\') || /[\r\n]/.test(path)) return false
  // Reject absolute / protocol-relative forms outright
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false
  if (path.startsWith('//')) return false
  return true
}

/** Stash the validated return-to path (sessionStorage, same tab). */
export function setPendingReturnTo(path: string): void {
  if (typeof window === 'undefined') return
  if (!isValidReturnTo(path)) return
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    /* private mode / storage full — flow degrades gracefully */
  }
}

/**
 * Read + clear the pending return-to path.
 * Returns null when absent or invalid.
 */
export function consumePendingReturnTo(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw === null) return null
    sessionStorage.removeItem(KEY)
    return isValidReturnTo(raw) ? raw : null
  } catch {
    return null
  }
}
