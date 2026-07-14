import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'গোপনীয়তা নীতি',
  description: 'AmarDeal (আমারডিল) এর গোপনীয়তা নীতি। আপনার ব্যক্তিগত তথ্য কিভাবে সংগ্রহ, ব্যবহার ও সুরক্ষিত হয় তা জানুন। Amar Deal আপনার তথ্য সম্পূর্ণ গোপন রাখে।',
  keywords: ['amardeal privacy', 'আমারডিল গোপনীয়তা', 'amar deal privacy policy', 'ডেটা সুরক্ষা'],
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: 'গোপনীয়তা নীতি | AmarDeal আমারডিল',
    description: 'আপনার তথ্য কিভাবে সুরক্ষিত আছে - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/privacy`,
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
    { '@type': 'ListItem', position: 2, name: 'গোপনীয়তা নীতি', item: `${SITE_URL}/privacy` },
  ],
};

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <AppShell initialView="page-privacy" />
    </>
  );
}