import type { Metadata } from 'next';
import { SeoPageLayout } from '@/components/seo-page-layout';
import { AboutSection } from '@/components/landing/about-section';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'আমাদের সম্পর্কে - নিরাপদ লেনদেনের বিশ্বস্ত ঠিকানা',
  description: 'Midman (মিডম্যান) বাংলাদেশের প্রথম বাংলা ভাষার এসক্রো প্ল্যাটফর্ম। আমাদের লক্ষ্য, মিশন ও সেবা সম্পর্কে জানুন। Midman দিয়ে প্রতারণামুক্ত লেনদেন করুন।',
  keywords: ['midman about', 'মিডম্যান সম্পর্কে', 'midman company', 'এসক্রো প্ল্যাটফর্ম বাংলাদেশ', 'বাংলা এসক্রো'],
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'আমাদের সম্পর্কে',
    description: 'নিরাপদ লেনদেনের বিশ্বস্ত ঠিকানা - Midman (মিডম্যান)',
    url: `${SITE_URL}/about`,
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
    { '@type': 'ListItem', position: 2, name: 'আমাদের সম্পর্কে', item: `${SITE_URL}/about` },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <SeoPageLayout title="আমাদের সম্পর্কে" subtitle="নিরাপদ লেনদেনের বিশ্বস্ত ঠিকানা">
        <AboutSection />
      </SeoPageLayout>
    </>
  );
}