import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Public marketplace banner feed.
 *
 * The admin marketplace panel lets admins upload ad-banner images
 * (Cloudflare R2, byte-for-byte / no recompression) and manage them —
 * but until now nothing on the public site displayed them. This endpoint
 * is what the marketplace ad-banner carousel consumes.
 *
 * Deliberately NOT under /api/admin/* — the public storefront should not
 * depend on the admin route group (its public-route exemptions in proxy.ts
 * are security-sensitive and easy to break accidentally).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const banners = await db.marketplaceBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        image: true,
        link: true,
      },
    })
    return NextResponse.json(
      { banners },
      // Short edge/client cache so new banners appear quickly after publishing
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
    )
  } catch {
    // Never break the marketplace — the UI falls back to the promo slider
    return NextResponse.json({ banners: [] })
  }
}
