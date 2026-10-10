import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

// Revalidate service pages every 5 minutes
export const revalidate = 300;

async function getService(id: string) {
  try {
    // Only published + active services are ever rendered to crawlers
    return await db.marketplaceService.findFirst({
      where: { id, status: 'published', isActive: true },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const service = await getService(id);

  if (!service) {
    return { title: 'সার্ভিস পাওয়া যায়নি' };
  }

  const title = `${service.name} — ৳${service.pricePerThousand.toLocaleString('en-BD')} / 1,000`;
  const description = `${service.name} মাত্র ৳${service.pricePerThousand.toLocaleString('en-BD')} প্রতি 1,000 ইউনিট। Midman মার্কেটপ্লেসে সরাসরি অর্ডার করুন — পেমেন্ট ভেরিফিকেশনের পরেই কাজ শুরু। ${service.description.slice(0, 120)}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/service/${service.id}`,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/service/${service.id}`,
      type: 'website',
      locale: 'bn_BD',
      siteName: 'Midman মিডম্যান',
      images: [{ url: `${SITE_URL}/logo.svg`, width: 1200, height: 630, alt: service.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/logo.svg`],
    },
  };
}

export default async function ServiceOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService(id);

  // JSON-LD Service schema for search engines
  const jsonLd = service ? {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${SITE_URL}/service/${service.id}`,
    name: service.name,
    description: service.description,
    url: `${SITE_URL}/service/${service.id}`,
    provider: {
      '@type': 'Organization',
      name: 'Midman',
      url: SITE_URL,
    },
    areaServed: 'BD',
    offers: {
      '@type': 'Offer',
      price: service.pricePerThousand,
      priceCurrency: 'BDT',
      availability: 'https://schema.org/InStock',
    },
  } : null;

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
  );
}
