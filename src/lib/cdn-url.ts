/**
 * CDN URL normalization utility.
 *
 * Problem: Brave browser Shields blocks cross-origin images even when they are
 * publicly accessible. The fix is to proxy all CDN images through the same
 * origin via a Next.js rewrite (/cdn/:path* → https://cdn.midman.bd/:path*).
 *
 * This function converts any `https://cdn.midman.bd/xxx` URL to `/cdn/xxx`
 * so the browser loads it as a same-origin request, bypassing Brave Shields.
 *
 * It also handles URLs that are already proxied (idempotent), and returns
 * null/undefined/empty strings as-is.
 */

const R2_CDN_HOST = 'cdn.midman.bd'

const CDN_REGEX = new RegExp(`^https?:\\/\\/${R2_CDN_HOST.replace('.', '\\.')}/(.+)$`, 'i')

export function cdnUrl(url: string | null | undefined): string | null {
  if (!url) return null
  // Already proxied
  if (url.startsWith('/cdn/')) return url
  // Convert full CDN URL to proxy URL
  const match = url.match(CDN_REGEX)
  if (match) return `/cdn/${match[1]}`
  // Non-CDN URL (e.g. external image, data URI) — return as-is
  return url
}
