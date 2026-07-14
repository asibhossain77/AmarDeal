import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'ফি কাঠামো - স্বচ্ছ ও সাশ্রয়ী',
  description: 'AmarDeal (আমারডিল) এর স্বচ্ছ ও সাশ্রয়ী ফি কাঠামো দেখুন। লেনদেনের পরিমাণ অনুযায়ী ফি নির্ধারিত হয়। কোনো লুকানো চার্জ নেই। Amar Deal এ সবচেয়ে কম ফিতে নিরাপদ লেনদেন।',
  keywords: ['amardeal fees', 'আমারডিল ফি', 'এসক্রো ফি কাঠামো', 'লেনদেন ফি', 'amar deal fee structure'],
  alternates: { canonical: `${SITE_URL}/fees` },
  openGraph: {
    title: 'ফি কাঠামো | AmarDeal আমারডিল',
    description: 'স্বচ্ছ ও সাশ্রয়ী ফি স্ট্রাকচার - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/fees`,
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
    { '@type': 'ListItem', position: 2, name: 'ফি কাঠামো', item: `${SITE_URL}/fees` },
  ],
};

export default function FeesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <AppShell initialView="page-fees" />
    </>
  );
}