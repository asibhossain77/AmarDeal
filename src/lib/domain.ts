/* ═══════════════════════════════════════════════════════════════
   Subdomain Routing Utility
   midman.bd  → Landing page only
   my.midman.bd  → Full app (login, dashboard, admin)
   ═══════════════════════════════════════════════════════════════ */

/**
 * The app subdomain — where login, dashboard, admin live.
 * In development (localhost) this has no effect.
 */
export const APP_DOMAIN = 'https://my.midman.bd';

/**
 * Domains that serve ONLY the landing page.
 * Anything else (localhost, my.midman.bd, vercel.app) is the app domain.
 */
const LANDING_DOMAINS = new Set([
  'midman.bd',
  'www.midman.bd',
]);

/**
 * Client-side: check if the current browser is on the landing domain.
 * Returns false during SSR or when on the app domain.
 */
export function isLandingDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return LANDING_DOMAINS.has(host);
}

/**
 * Build a full URL pointing to the app subdomain.
 * On the app domain, returns a relative path (no domain prefix).
 */
export function getAppUrl(path: string = '/'): string {
  if (isLandingDomain()) {
    return APP_DOMAIN + path;
  }
  return path;
}

/**
 * Navigate to a path on the app subdomain.
 * On the landing domain, does a full page navigation to my.midman.bd.
 * On the app domain, returns the path for client-side routing.
 *
 * Returns undefined if on app domain (caller should use setView/pushUrl instead).
 * Returns the full URL if on landing domain (caller should use window.location.href).
 */
export function getAppNavigationUrl(path: string): string | undefined {
  if (isLandingDomain()) {
    return APP_DOMAIN + path;
  }
  return undefined;
}
