import type { Metadata } from 'next';
import { SeoPageLayout } from '@/components/seo-page-layout';
import { ContractSection } from '@/components/landing/contract-section';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'শর্তাবলী ও চুক্তি',
  description: 'Midman (মিডম্যান) ব্যবহারের শর্তাবলী ও চুক্তি। এসক্রো সার্ভিস ব্যবহারের নিয়ম, দায়িত্ব ও সীমাবদ্ধতা সম্পর্কে জানুন। Midman ব্যবহারের সম্পূর্ণ শর্তাবলী।',
  keywords: ['midman terms', 'মিডম্যান শর্তাবলী', 'midman bd terms of service', 'এসক্রো শর্ত'],
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: 'শর্তাবলী',
    description: 'সেবার শর্তাবলী ও ব্যবহারের শর্ত - Midman (মিডম্যান)',
    url: `${SITE_URL}/terms`,
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
    { '@type': 'ListItem', position: 2, name: 'শর্তাবলী', item: `${SITE_URL}/terms` },
  ],
};

export default function TermsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <SeoPageLayout title="শর্তাবলী ও চুক্তি" subtitle="আমাদের সেবার শর্তাবলী ও ব্যবহারের শর্ত">
        <ContractSection />
      </SeoPageLayout>
    </>
  );
}