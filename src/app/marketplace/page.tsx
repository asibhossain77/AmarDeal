import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

const CATEGORIES_BN: Record<string, string> = {
  design: '\u09A1\u09BF\u099C\u09BE\u0987\u09A8',
  development: '\u09A1\u09C7\u09AD\u09C7\u09B2\u09AA\u09AE\u09C7\u09A8\u09CD\u099F',
  content: '\u0995\u09A8\u09CD\u099F\u09C7\u09A8\u09CD\u099F',
  marketing: '\u09AE\u09BE\u09B0\u09CD\u0995\u09C7\u099F\u09BF\u0982',
  education: '\u09B6\u09BF\u0995\u09CD\u09B7\u09BE',
  software: '\u09B8\u09AB\u099F\u0993\u09AF\u09BC\u09CD\u09AF\u09BE\u09B0',
  other: '\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF',
};

export async function generateMetadata(): Promise<Metadata> {
  const products = await db.digitalProduct.findMany({
    where: { status: 'active' },
    select: { title: true, price: true, image: true, category: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  const productTitles = products.map(p => p.title).join(', ');
  const categories = [...new Set(products.map(p => p.category))];
  const categoryNames = categories
    .map(c => CATEGORIES_BN[c] || c)
    .join(', ');

  let siteLogoUrl = `${SITE_URL}/logo.svg`;
  try {
    const logoSetting = await db.platformSetting.findUnique({ where: { key: 'site_logo' } });
    if (logoSetting?.value && !logoSetting.value.startsWith('data:')) {
      siteLogoUrl = logoSetting.value.startsWith('http') ? logoSetting.value : `${SITE_URL}${logoSetting.value}`;
    }
  } catch { /* fallback */ }

  return {
    title: 'ডিজিটাল মার্কেটপ্লেস - নিরাপদে ডিজিটাল পণ্য কিনুন ও বিক্রি করুন | Midman মিডম্যান',
    description: `Midman মিডম্যান মার্কেটপ্লেসে ${products.length}টিরও বেশি ডিজিটাল পণ্য পাবেন। ${categoryNames || 'ডিজিটাল'} ক্যাটাগরিতে সেরা পণ্য কিনুন। সরাসরি সেলারের সাথে চ্যাট করুন বা মিডম্যান এসক্রো ডিলের মাধ্যমে ১০০% নিরাপদে অর্ডার করুন। বাংলাদেশের সবচেয়ে নিরাপদ ডিজিটাল মার্কেটপ্লেস।`,
    keywords: [
      'digital marketplace Bangladesh',
      'ডিজিটাল মার্কেটপ্লেস',
      'ডিজিটাল পণ্য কিনুন',
      'অনলাইন মার্কেটপ্লেস বাংলাদেশ',
      'midman marketplace',
      'মিডম্যান মার্কেটপ্লেস',
      'নিরাপদ ডিজিটাল কেনাবেচা',
      'সেলার মার্কেটপ্লেস বাংলাদেশ',
      'ফ্রিল্যান্স সার্ভিস মার্কেটপ্লেস',
      'design marketplace Bangladesh',
      'development services Bangladesh',
      'content writing service Bangladesh',
      'digital product Bangladesh',
      'বাংলাদেশে ডিজিটাল পণ্য',
      'online escrow marketplace',
      'P2P digital marketplace',
      'secure digital marketplace bd',
      ...productTitles.split(', ').slice(0, 10),
    ],
    alternates: {
      canonical: `${SITE_URL}/marketplace`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title: 'ডিজিটাল মার্কেটপ্লেস | Midman মিডম্যান - বাংলাদেশের নিরাপদ ডিজিটাল কেনাবেচা',
      description: `বাংলাদেশের সবচেয়ে নিরাপদ ডিজিটাল মার্কেটপ্লেস। ${products.length}টি+ পণ্য, ${categories.length}টি ক্যাটাগরি। এসক্রো সুরক্ষা সহ ডিজিটাল সেবা কিনুন ও বিক্রি করুন।`,
      url: `${SITE_URL}/marketplace`,
      type: 'website',
      locale: 'bn_BD',
      siteName: 'Midman মিডম্যান',
      images: [
        {
          url: siteLogoUrl,
          width: 1200,
          height: 630,
          alt: 'Midman মিডম্যান ডিজিটাল মার্কেটপ্লেস - নিরাপদে কিনুন ও বিক্রি করুন',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'ডিজিটাল মার্কেটপ্লেস | Midman মিডম্যান',
      description: `বাংলাদেশের নিরাপদ ডিজিটাল মার্কেটপ্লেস। ${products.length}টি+ পণ্য, এসক্রো সুরক্ষা সহ ডিজিটাল কেনাবেচা।`,
      images: [siteLogoUrl],
    },
  };
}

function buildJsonLd(products: { id: string; title: string; description: string; price: number; image: string | null; category: string; createdAt: Date; seller: { name: string } }[]) {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE_URL}/marketplace#product-list`,
    name: 'Midman মিডম্যান ডিজিটাল মার্কেটপ্লেস',
    description: 'বাংলাদেশের সবচেয়ে নিরাপদ ডিজিটাল পণ্যের মার্কেটপ্লেস। এসক্রো সুরক্ষা সহ ডিজিটাল সেবা কিনুন ও বিক্রি করুন।',
    url: `${SITE_URL}/marketplace`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        '@id': `${SITE_URL}/marketplace#product-${p.id}`,
        name: p.title,
        description: p.description,
        url: `${SITE_URL}/marketplace`,
        image: p.image ? (p.image.startsWith('http') ? p.image : `${SITE_URL}${p.image}`) : siteLogoUrl,
        offers: {
          '@type': 'Offer',
          price: p.price,
          priceCurrency: 'BDT',
          availability: 'https://schema.org/InStock',
          seller: {
            '@type': 'Organization',
            name: p.seller.name,
          },
        },
        category: CATEGORIES_BN[p.category] || p.category,
      },
    })),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${SITE_URL}/marketplace#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'হোম',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'মার্কেটপ্লেস',
        item: `${SITE_URL}/marketplace`,
      },
    ],
  };

  const marketplacePage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/marketplace#webpage`,
    url: `${SITE_URL}/marketplace`,
    name: 'ডিজিটাল মার্কেটপ্লেস - Midman মিডম্যান',
    description: 'বাংলাদেশের সবচেয়ে নিরাপদ ডিজিটাল পণ্যের মার্কেটপ্লেস। ডিজাইন, ডেভেলপমেন্ট, কন্টেন্ট, মার্কেটিং, শিক্ষা ও সফটওয়্যার ক্যাটাগরিতে পণ্য পান।',
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
    about: {
      '@id': `${SITE_URL}/#organization`,
    },
    inLanguage: 'bn-BD',
    mainEntity: {
      '@id': `${SITE_URL}/marketplace#product-list`,
    },
  };

  const categoryList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE_URL}/marketplace#categories`,
    name: 'মার্কেটপ্লেস ক্যাটাগরি সমূহ',
    numberOfItems: Object.keys(CATEGORIES_BN).length,
    itemListElement: Object.entries(CATEGORIES_BN).map(([key, name], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      url: `${SITE_URL}/marketplace?category=${key}`,
    })),
  };

  return [itemList, breadcrumb, marketplacePage, categoryList];
}

export default async function MarketplacePage() {
  const products = await db.digitalProduct.findMany({
    where: { status: 'active' },
    select: {
      id: true, title: true, description: true, price: true,
      image: true, category: true, createdAt: true,
      seller: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const jsonLdArray = buildJsonLd(products);

  return (
    <>
      {jsonLdArray.map((jsonLd, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ))}
      <AppShell />
    </>
  );
}
