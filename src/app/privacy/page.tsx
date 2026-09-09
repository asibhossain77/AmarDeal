import type { Metadata } from 'next';
import { SeoPageLayout } from '@/components/seo-page-layout';
import { PrivacySection } from '@/components/landing/privacy-section';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'গোপনীয়তা নীতি',
  description: 'Midman (মিডম্যান) এর গোপনীয়তা নীতি। আপনার ব্যক্তিগত তথ্য কিভাবে সংগ্রহ, ব্যবহার ও সুরক্ষিত হয় তা জানুন। Midman আপনার তথ্য সম্পূর্ণ গোপন রাখে।',
  keywords: ['midman privacy', 'মিডম্যান গোপনীয়তা', 'midman privacy policy', 'ডেটা সুরক্ষা'],
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: 'গোপনীয়তা নীতি',
    description: 'আপনার তথ্য কিভাবে সুরক্ষিত আছে - Midman (মিডম্যান)',
    url: `${SITE_URL}/privacy`,
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
    { '@type': 'ListItem', position: 2, name: 'গোপনীয়তা নীতি', item: `${SITE_URL}/privacy` },
  ],
};

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <SeoPageLayout title="গোপনীয়তা নীতি" subtitle="আপনার তথ্য কিভাবে সুরক্ষিত আছে তা জানুন">
        <PrivacySection />
      </SeoPageLayout>
    </>
  );
}