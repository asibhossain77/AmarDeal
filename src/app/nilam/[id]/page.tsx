import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

interface AuctionPageProps {
  params: Promise<{ id: string }>;
}

async function getAuction(id: string) {
  try {
    return await db.auction.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true, image: true,
        startPrice: true, currentPrice: true, bidCount: true,
        status: true, endsAt: true, createdAt: true,
        seller: { select: { name: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: AuctionPageProps): Promise<Metadata> {
  const { id } = await params;
  const auction = await getAuction(id);

  if (!auction) {
    return { title: 'নিলাম পাওয়া যায়নি | Midman' };
  }

  const price = auction.currentPrice ?? auction.startPrice;
  const title = `${auction.title} — লাইভ নিলাম | Midman`;
  const description = `${auction.title} — বর্তমান বিড ৳${Math.round(price).toLocaleString('en')} (${auction.bidCount}টি বিড)। Midman নিলামে বিড করুন — সর্বোচ্চ বিডার জয়ী হবেন এবং মিডম্যান এসক্রো সুরক্ষায় পণ্য কিনতে পারবেন।`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: auction.title,
    description: auction.description.slice(0, 300),
    image: auction.image ? [auction.image.startsWith('http') ? auction.image : `${SITE_URL}${auction.image}`] : undefined,
    offers: {
      '@type': 'Offer',
      price: Math.round(price),
      priceCurrency: 'BDT',
      availability: auction.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      seller: { '@type': 'Person', name: auction.seller?.name || 'Midman Seller' },
    },
  };

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/nilam/${id}` },
    robots: { index: auction.status === 'active', follow: true },
    openGraph: { title, description, type: 'website' },
    other: {
      'script:ld+json': JSON.stringify(jsonLd),
    } as Record<string, string>,
  };
}

export default async function AuctionDetailPage({ params }: AuctionPageProps) {
  // The id is read from the URL by url-sync → store → AuctionDetailView.
  // We await params here only to satisfy the App Router contract.
  const { id: _ignored } = await params;
  void _ignored;
  return <AppShell />;
}
