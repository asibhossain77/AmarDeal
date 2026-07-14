import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'ব্লগ - নিরাপদ লেনদেন ও এসক্রো সম্পর্কে আর্টিকেল',
  description: 'AmarDeal (আমারডিল) ব্লগে নিরাপদ অনলাইন লেনদেন, এসক্রো সার্ভিস, ফ্রিল্যান্সিং পেমেন্ট ও অনলাইন কেনাবেচার টিপস সম্পর্কে বিস্তারিত আর্টিকেল পড়ুন। Amar Deal এর সর্বশেষ আপডেট ও গাইড।',
  keywords: ['amardeal blog', 'আমারডিল ব্লগ', 'এসক্রো ব্লগ', 'নিরাপদ লেনদেন গাইড', 'অনলাইন লেনদেন টিপস', 'amar deal article'],
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'ব্লগ | AmarDeal আমারডিল',
    description: 'নিরাপদ অনলাইন লেনদেন ও এসক্রো সম্পর্কে আর্টিকেল - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/blog`,
    type: 'website',
    locale: 'bn_BD',
    siteName: 'AmarDeal আমারডিল',
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