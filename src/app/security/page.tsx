import type { Metadata } from 'next';
import { SeoPageLayout } from '@/components/seo-page-layout';
import { TrustSecurity } from '@/components/landing/trust-security';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'নিরাপত্তা - সম্পূর্ণ সুরক্ষিত লেনদেন',
  description: 'AmarDeal (আমারডিল) এ আপনার লেনদেন সম্পূর্ণ নিরাপদ। এসক্রো সিস্টেম, এনক্রিপশন ও সার্ভার সিকিউরিটি দিয়ে আপনার তথ্য ও টাকা সুরক্ষিত। Amar Deal এ প্রতারণার ঝুঁকি শূন্য।',
  keywords: ['amardeal security', 'আমারডিল নিরাপত্তা', 'এসক্রো সিকিউরিটি', 'নিরাপদ লেনদেন', 'amar deal secure', 'online fraud protection Bangladesh'],
  alternates: { canonical: `${SITE_URL}/security` },
  openGraph: {
    title: 'নিরাপত্তা | AmarDeal আমারডিল',
    description: 'আপনার লেনদেন সম্পূর্ণ সুরক্ষিত - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/security`,
    type: 'website',
    locale: 'bn_BD',
    siteName: 'AmarDeal আমারডিল',
  },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'নিরাপত্তা', item: `${SITE_URL}/security` },
  ],
};

export default function SecurityPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <SeoPageLayout title="নিরাপত্তা" subtitle="আপনার লেনদেন সম্পূর্ণ সুরক্ষিত">
        <TrustSecurity />
      </SeoPageLayout>
    </>
  );
}