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
 */
const LANDING_DOMAINS = new Set([
  'midman.bd',
  'www.midman.bd',
]);

/**
 * The explicit app subdomain.
 * Only this domain is treated as the app domain.
 * localhost, vercel.app, etc. behave as neutral (landing page visible).
 */
const APP_DOMAINS = new Set([
  'my.midman.bd',
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
 * Client-side: check if the current browser is on the app subdomain.
 * Returns true ONLY for my.midman.bd.
 * Returns false for midman.bd, www.midman.bd, localhost, vercel.app, etc.
 *
 * This ensures:
 * - Production: my.midman.bd → app (never landing), midman.bd → landing only
 * - Development: localhost → neutral (landing page visible for testing)
 */
export function isAppDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return APP_DOMAINS.has(window.location.hostname);
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
