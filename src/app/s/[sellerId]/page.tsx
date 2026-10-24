import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { db } from '@/lib/db';

export const revalidate = 300;

type Props = { params: Promise<{ sellerId: string }> };

async function getStore(sellerId: string) {
  try {
    const seller = await db.user.findUnique({
      where: { id: sellerId },
      select: {
        id: true, name: true, businessName: true, businessBio: true,
        businessCategory: true, isSeller: true, sellerDisabled: true,
        businessVerified: true,
      },
    })
    if (!seller || !seller.isSeller) return null

    const [productCount, reviewAgg] = await Promise.all([
      db.digitalProduct.count({ where: { sellerId, status: 'active' } }),
      db.sellerReview.aggregate({
        where: { sellerId, status: 'published' },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ])

    return { seller, productCount, reviewAgg }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sellerId } = await params
  const store = await getStore(sellerId)

  if (!store) {
    return { title: 'সেলার প্রোফাইল', robots: { index: false } }
  }

  const storeName = store.seller.businessName || store.seller.name
  const suspended = store.seller.sellerDisabled
  const rating = store.reviewAgg._avg.rating ? Math.round(store.reviewAgg._avg.rating * 10) / 10 : null

  return {
    title: suspended
      ? `${storeName} — স্টোর সাময়িকভাবে বন্ধ`
      : `${storeName} — ${store.seller.businessVerified ? 'যাচাইকৃত বিজনেস স্টোর' : 'স্টোর'}${rating ? ` (★ ${rating})` : ''}`,
    description: store.seller.businessBio
      ? `${store.seller.businessBio.slice(0, 150)}`
      : `${storeName} — Midman.bd মার্কেটপ্লেসে ${store.productCount}টি পণ্য সহ স্টোর।`,
    alternates: { canonical: `/s/${sellerId}` },
    openGraph: {
      title: `${storeName} — Midman.bd`,
      description: store.seller.businessBio?.slice(0, 150) || undefined,
      type: 'profile',
    },
    robots: suspended ? { index: false, follow: false } : undefined,
  }
}

export default async function SellerProfilePage({ params }: Props) {
  const { sellerId } = await params
  const store = await getStore(sellerId)

  // JSON-LD: Store + aggregateRating (published reviews only, active stores only)
  let jsonLd: Record<string, unknown> | null = null
  if (store && !store.seller.sellerDisabled) {
    const storeName = store.seller.businessName || store.seller.name
    const ratingCount = store.reviewAgg._count.id
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: storeName,
      description: store.seller.businessBio || undefined,
      url: `https://midman.bd/s/${sellerId}`,
      ...(store.seller.businessCategory ? { keywords: store.seller.businessCategory } : {}),
      ...(ratingCount > 0 && store.reviewAgg._avg.rating
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Math.round(store.reviewAgg._avg.rating * 10) / 10,
              reviewCount: ratingCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <AppShell />
    </>
  )
}
