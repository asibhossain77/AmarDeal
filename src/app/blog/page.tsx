import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'ব্লগ - নিরাপদ লেনদেন ও এসক্রো সম্পর্কে আর্টিকেল',
  description: 'Midman (মিডম্যান) ব্লগে নিরাপদ অনলাইন লেনদেন, এসক্রো সার্ভিস, ফ্রিল্যান্সিং পেমেন্ট ও অনলাইন কেনাবেচার টিপস সম্পর্কে বিস্তারিত আর্টিকেল পড়ুন। Midman এর সর্বশেষ আপডেট ও গাইড।',
  keywords: ['midman blog', 'মিডম্যান ব্লগ', 'এসক্রো ব্লগ', 'নিরাপদ লেনদেন গাইড', 'অনলাইন লেনদেন টিপস', 'midman article'],
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'ব্লগ | Midman মিডম্যান',
    description: 'নিরাপদ অনলাইন লেনদেন ও এসক্রো সম্পর্কে আর্টিকেল - Midman (মিডম্যান)',
    url: `${SITE_URL}/blog`,
    type: 'website',
    locale: 'bn_BD',
    siteName: 'Midman মিডম্যান',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'ব্লগ', item: `${SITE_URL}/blog` },
  ],
};

export default function BlogPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <AppShell initialView="blog" />
    </>
  );
}