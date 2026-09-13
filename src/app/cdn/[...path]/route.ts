import { NextRequest } from 'next/server'

/**
 * CDN image proxy — serves R2-hosted images through the app's own origin.
 *
 * Why a route handler instead of a plain external rewrite?
 * next.config `headers()` does NOT merge into external-rewrite responses
 * (verified locally), so /cdn/ images previously went out with NO
 * Cache-Control at all. Result: every page view re-downloaded every image
 * through Vercel (browser → Vercel → Cloudflare R2 → Vercel → browser),
 * burning Fast Data Transfer + Fast Origin Transfer on Vercel.
 *
 * This handler adds explicit immutable caching:
 * - `max-age=31536000` → the BROWSER caches the image for 1 year
 *   (repeat views never reach Vercel at all)
 * - `s-maxage=31536000` → Vercel's edge CDN caches it too (cross-user
 *   first views are served from the edge without a new origin fetch)
 *
 * Safe to cache forever: uploadToR2() gives every upload a unique
 * timestamped key, so a URL's content can never change.
 */

const UPSTREAM = process.env.R2_PUBLIC_URL || 'https://cdn.midman.bd'

export const dynamic = 'force-dynamic'

const PASS_THROUGH_HEADERS = [
  'content-type',
  'content-length',
  'etag',
  'last-modified',
  'accept-ranges',
  'content-range',
] as const

// Never cache a failed lookup for long — allow recovery if the file
// appears later, without letting 404s cause a stampede.
const ERROR_CACHE_CONTROL = 'public, max-age=60'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params

  // Path traversal guard — R2 keys never contain ".." or null bytes
  if (!segments.length || segments.some((s) => s === '..' || s.includes('\0') || s.includes('\\'))) {
    return new Response('Bad request', { status: 400 })
  }

  const upstreamUrl = `${UPSTREAM}/${segments.map(encodeURIComponent).join('/')}`

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      cache: 'no-store',
      headers: { 'user-agent': 'midman-cdn-proxy/1.0' },
    })
  } catch {
    return new Response('CDN upstream error', {
      status: 502,
      headers: { 'Cache-Control': ERROR_CACHE_CONTROL },
    })
  }

  const headers = new Headers()
  headers.set(
    'Cache-Control',
    upstream.ok ? 'public, max-age=31536000, s-maxage=31536000, immutable' : ERROR_CACHE_CONTROL,
  )
  for (const name of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Same-origin already, but harmless for any external embedding
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin')

  return new Response(upstream.body, { status: upstream.status, headers })
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const res = await GET(req, ctx)
  return new Response(null, { status: res.status, headers: res.headers })
}
