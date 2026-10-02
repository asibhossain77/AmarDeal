/**
 * Bridge origin allowlist + return-URL sanitisation (isomorphic — safe to
 * import from client components; NO node builtins here).
 *
 * Trusted domains only:
 *   - production: https://verify.midman.bd (+ https://midman.bd itself)
 *   - dev/preview: extra origins via ALLOWED_BRIDGE_ORIGINS (comma-separated)
 *
 * Nothing else may receive a bridge token or a post-logout redirect — this
 * is the open-redirect guard.
 */

export const PROD_BRIDGE_ORIGINS = ['https://verify.midman.bd', 'https://midman.bd'] as const

/** Origins allowed to receive bridge handoffs / post-logout redirects. */
export function getAllowedBridgeOrigins(): string[] {
  const extra = (process.env.ALLOWED_BRIDGE_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && extra.length === 0) return [...PROD_BRIDGE_ORIGINS]
  // Non-production: allow localhost variants for local E2E between the two apps
  return [...PROD_BRIDGE_ORIGINS, ...extra, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']
}

/** True when `url` is an absolute URL whose origin is explicitly allowlisted. */
export function isAllowedBridgeOrigin(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && !u.origin.startsWith('http://localhost')) return false
    return getAllowedBridgeOrigins().includes(u.origin)
  } catch {
    return false
  }
}

/**
 * Sanitise a `?next=` return target (used after midman login when the bridge
 * bounced the user there). Allows ONLY:
 *   - same-origin relative paths (single leading slash, never `//`)
 *   - absolute URLs whose origin is in the bridge allowlist
 * Everything else → null (open-redirect guard).
 */
export function sanitizeNextParam(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (raw.length > 2048) return null
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    return raw
  }
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && !u.origin.startsWith('http://localhost')) return null
    return getAllowedBridgeOrigins().includes(u.origin) ? raw : null
  } catch {
    return null
  }
}
