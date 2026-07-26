/**
 * In-memory Fixed-Window Rate Limiter for Edge Runtime.
 *
 * Works in Next.js proxy.ts (Edge Runtime) where Node.js APIs like
 * setInterval/setTimeout are NOT available. Uses lazy cleanup.
 *
 * Limit categories:
 *   - auth-strict:  login, register, forgot-password, reset-password, 2FA verify
 *   - auth-moderate: verify-otp, check-email, resend-verify-email
 *   - sensitive:     reviews (POST), ai-support, contact form
 *   - api-general:   all other /api/* routes
 *   - page:          non-API routes (very permissive)
 */

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when this bucket expires
}

type LimitCategory = 'auth-strict' | 'auth-moderate' | 'sensitive' | 'api-general' | 'page';

/* ------------------------------------------------------------------ */
/*  Configuration                                                       */
/* ------------------------------------------------------------------ */

const LIMITS: Record<LimitCategory, RateLimitConfig> = {
  // Brute-force prevention: 5 req/min
  'auth-strict':   { maxRequests: 5,  windowMs: 60_000 },
  // Anti-spam: 10 req/min
  'auth-moderate': { maxRequests: 10, windowMs: 60_000 },
  // Abuse prevention: 5 req/min
  'sensitive':     { maxRequests: 5,  windowMs: 60_000 },
  // General API safety net: 60 req/min
  'api-general':   { maxRequests: 60, windowMs: 60_000 },
  // Page loads: 120 req/min (very permissive)
  'page':          { maxRequests: 120, windowMs: 60_000 },
};

/* ------------------------------------------------------------------ */
/*  In-memory store (Map works in Edge Runtime)                        */
/* ------------------------------------------------------------------ */

const store = new Map<string, Bucket>();

/* ------------------------------------------------------------------ */
/*  Route → category mapping                                           */
/* ------------------------------------------------------------------ */

function getCategory(pathname: string, method: string): LimitCategory {
  // Auth — strict (login, register, password reset, 2FA)
  if (
    (pathname === '/api/auth/login' && method === 'POST') ||
    (pathname === '/api/auth/register' && method === 'POST') ||
    (pathname === '/api/auth/forgot-password' && method === 'POST') ||
    (pathname === '/api/auth/reset-password' && method === 'POST') ||
    (pathname === '/api/admin/2fa/login-verify' && method === 'POST')
  ) {
    return 'auth-strict';
  }

  // Auth — moderate (OTP verify, email check, resend)
  if (
    (pathname === '/api/auth/verify-otp' && method === 'POST') ||
    (pathname === '/api/auth/check-email' && method === 'POST') ||
    (pathname === '/api/auth/resend-verify-email' && method === 'POST')
  ) {
    return 'auth-moderate';
  }

  // Sensitive — reviews, AI support, contact
  if (
    (pathname === '/api/reviews' && method === 'POST') ||
    (pathname === '/api/ai-support' && method === 'POST') ||
    pathname === '/api/contact'
  ) {
    return 'sensitive';
  }

  // API routes — general
  if (pathname.startsWith('/api/')) {
    return 'api-general';
  }

  // Page loads
  return 'page';
}

/* ------------------------------------------------------------------ */
/*  Core: check rate limit                                              */
/* ------------------------------------------------------------------ */

/**
 * Check if the request is within rate limits.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 */
export function checkRateLimit(
  pathname: string,
  method: string,
  ip: string,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const category = getCategory(pathname, method);
  const config = LIMITS[category];
  const now = Date.now();

  // Key: category + IP (per-route + per-IP limiting)
  const key = `${category}:${ip}`;

  // Lazy cleanup: remove expired bucket if present
  const existing = store.get(key);
  if (existing && now >= existing.resetAt) {
    store.delete(key);
  }

  // Get or create bucket
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    store.set(key, bucket);
  }

  // Check limit
  bucket.count++;
  if (bucket.count > config.maxRequests) {
    const retryAfterMs = bucket.resetAt - now;
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true };
}

/**
 * Get human-readable limit info for a route (useful for headers / logging).
 */
export function getLimitInfo(pathname: string, method: string): { maxRequests: number; windowSec: number } {
  const category = getCategory(pathname, method);
  const config = LIMITS[category];
  return { maxRequests: config.maxRequests, windowSec: Math.round(config.windowMs / 1000) };
}
