/**
 * ─────────────────────────────────────────────────────────────────
 * Trusted OAuth 2.0 client registry (SERVER-SIDE ONLY)
 * ─────────────────────────────────────────────────────────────────
 *
 * "Continue with Midman" provider — clients allowed to use Midman
 * as an identity provider. This module is imported exclusively by
 * server routes/pages and must NEVER be imported from a client
 * component (keeps client credentials server-side).
 *
 * Public client registration is intentionally NOT supported — new
 * clients must be added here in code, reviewed like any other
 * security-sensitive change.
 *
 * redirectUris are EXACT string matches. No normalization, no
 * wildcard, no path/trailing-slash tolerance — this is the core
 * open-redirect defense.
 */

export interface OAuthClient {
  /** Public client identifier (safe to expose in URLs) */
  id: string
  /** Human-readable app name shown on the consent screen */
  name: string
  /** Public homepage of the client app */
  homepage: string
  /** Exact-match redirect URIs (HTTPS, registered) */
  redirectUris: string[]
  /** Name of the env var holding this client's secret (confidential client) */
  secretEnvVar: string
}

export const TRUSTED_OAUTH_CLIENTS: Record<string, OAuthClient> = {
  'midman-verify': {
    id: 'midman-verify',
    name: 'Midman Verify',
    homepage: 'https://verify.midman.bd',
    redirectUris: ['https://verify.midman.bd/auth/callback'],
    secretEnvVar: 'OAUTH_CLIENT_VERIFY_SECRET',
  },
}

/** Look up a client by id. Returns null for unknown/unregistered clients. */
export function getOAuthClient(clientId: string | null | undefined): OAuthClient | null {
  if (!clientId || typeof clientId !== 'string') return null
  return TRUSTED_OAUTH_CLIENTS[clientId] ?? null
}

/**
 * Resolve a client's secret from the environment.
 * Fails closed: returns null when the env var is missing/short —
 * the token endpoint will refuse to authenticate the client.
 * The secret value itself is NEVER logged.
 */
export function getClientSecret(client: OAuthClient): string | null {
  const secret = process.env[client.secretEnvVar]
  if (!secret || secret.length < 16) return null
  return secret
}
