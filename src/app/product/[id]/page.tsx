import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

// Revalidate product pages every 5 minutes
export const revalidate = 300;

interface ProductWithOptions {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string | null;
  status: string;
  productType?: string;
  options?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[];
  seller: { id: string; name: string; imageLink: string | null };
}

async function getProduct(id: string): Promise<ProductWithOptions | null> {
  try {
    return await db.digitalProduct.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, name: true, imageLink: true },
        },
        options: {
          select: { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  } catch {
    return null;
  }
}

// Display price for multi-price products: dynamic range from the options.
// A single available option (or equal prices) falls back to one price.
function priceRangeOf(product: ProductWithOptions): { min: number; max: number } | null {
  if (product.productType !== 'multi' || !product.options || product.options.length === 0) return null;
  const available = product.options.filter((o) => o.isAvailable);
  const prices = (available.length > 0 ? available : product.options).map((o) => o.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
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

  const range = priceRangeOf(product);
  const priceLabel = range && range.min !== range.max
    ? `৳${range.min.toLocaleString('en-BD')}–৳${range.max.toLocaleString('en-BD')}`
    : `৳${(range ? range.min : product.price).toLocaleString('en-BD')}`;

  const title = `${product.title} — ${priceLabel}`;
  const description = `${product.title} ${priceLabel}। ${product.seller.name} এর কাছ থেকে সরাসরি WhatsApp-এ যোগাযোগ করুন বা মিডম্যান এসক্রো ডিলের মাধ্যমে ১০০% নিরাপদে অর্ডার করুন। ${product.description.slice(0, 120)}`;

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

  // JSON-LD Product schema for search engines —
  // multi-price products expose an AggregateOffer with the real price range
  const range = product ? priceRangeOf(product) : null;
  const isMultiOffer = !!range && range.min !== range.max;
  const offerPrice = range ? range.min : product?.price ?? 0;
  const jsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE_URL}/product/${product.id}`,
    name: product.title,
    description: product.description,
    url: `${SITE_URL}/product/${product.id}`,
    image: product.image ? (product.image.startsWith('http') ? product.image : `${SITE_URL}${product.image}`) : `${SITE_URL}/logo.svg`,
    offers: isMultiOffer
      ? {
          '@type': 'AggregateOffer',
          lowPrice: range!.min,
          highPrice: range!.max,
          priceCurrency: 'BDT',
          offerCount: (product.options ?? []).filter((o) => o.isAvailable).length || (product.options ?? []).length,
          availability: product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: product.seller.name,
          },
        }
      : {
          '@type': 'Offer',
          price: offerPrice,
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
