import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'আমাদের সম্পর্কে - নিরাপদ লেনদেনের বিশ্বস্ত ঠিকানা',
  description: 'AmarDeal (আমারডিল) বাংলাদেশের প্রথম বাংলা ভাষার এসক্রো প্ল্যাটফর্ম। আমাদের লক্ষ্য, মিশন ও সেবা সম্পর্কে জানুন। Amar Deal দিয়ে প্রতারণামুক্ত লেনদেন করুন।',
  keywords: ['amardeal about', 'আমারডিল সম্পর্কে', 'amar deal company', 'এসক্রো প্ল্যাটফর্ম বাংলাদেশ', 'বাংলা এসক্রো'],
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'আমাদের সম্পর্কে | AmarDeal আমারডিল',
    description: 'নিরাপদ লেনদেনের বিশ্বস্ত ঠিকানা - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/about`,
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
    { '@type': 'ListItem', position: 2, name: 'আমাদের সম্পর্কে', item: `${SITE_URL}/about` },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <AppShell initialView="page-about" />
    </>
  );
}