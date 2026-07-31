import type { Metadata } from 'next';
import { SeoPageLayout } from '@/components/seo-page-layout';
import { FeeStructure } from '@/components/landing/fee-structure';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'ফি কাঠামো - স্বচ্ছ ও সাশ্রয়ী',
  description: 'Midman (মিডম্যান) এর স্বচ্ছ ও সাশ্রয়ী ফি কাঠামো দেখুন। লেনদেনের পরিমাণ অনুযায়ী ফি নির্ধারিত হয়। কোনো লুকানো চার্জ নেই। Midman এ সবচেয়ে কম ফিতে নিরাপদ লেনদেন।',
  keywords: ['midman fees', 'মিডম্যান ফি', 'এসক্রো ফি কাঠামো', 'লেনদেন ফি', 'midman fee structure'],
  alternates: { canonical: `${SITE_URL}/fees` },
  openGraph: {
    title: 'ফি কাঠামো | Midman মিডম্যান',
    description: 'স্বচ্ছ ও সাশ্রয়ী ফি স্ট্রাকচার - Midman (মিডম্যান)',
    url: `${SITE_URL}/fees`,
    type: 'website',
    locale: 'bn_BD',
    siteName: 'Midman মিডম্যান',
  },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'ফি কাঠামো', item: `${SITE_URL}/fees` },
  ],
};

export default function FeesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <SeoPageLayout title="ফি কাঠামো" subtitle="স্বচ্ছ ও সাশ্রয়ী ফি স্ট্রাকচার">
        <FeeStructure />
      </SeoPageLayout>
    </>
  );
}