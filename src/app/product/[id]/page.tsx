import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

// Revalidate product pages every 5 minutes
export const revalidate = 300;

async function getProduct(id: string) {
  try {
    return await db.digitalProduct.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, name: true, imageLink: true },
        },
      },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return { title: 'পণ্য পাওয়া যায়নি' };
  }

  let imageUrl = `${SITE_URL}/logo.svg`;
  if (product.image) {
    imageUrl = product.image.startsWith('http') ? product.image : `${SITE_URL}${product.image}`;
  }

  const title = `${product.title} — ৳${product.price.toLocaleString('en-BD')}`;
  const description = `${product.title} মাত্র ৳${product.price.toLocaleString('en-BD')}। ${product.seller.name} এর কাছ থেকে সরাসরি WhatsApp-এ যোগাযোগ করুন বা মিডম্যান এসক্রো ডিলের মাধ্যমে ১০০% নিরাপদে অর্ডার করুন। ${product.description.slice(0, 120)}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/product/${product.id}`,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/product/${product.id}`,
      type: 'website',
      locale: 'bn_BD',
      siteName: 'Midman মিডম্যান',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: product.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProductOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  // JSON-LD Product schema for search engines
  const jsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE_URL}/product/${product.id}`,
    name: product.title,
    description: product.description,
    url: `${SITE_URL}/product/${product.id}`,
    image: product.image ? (product.image.startsWith('http') ? product.image : `${SITE_URL}${product.image}`) : `${SITE_URL}/logo.svg`,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'BDT',
      availability: product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: product.seller.name,
      },
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
