import type { Metadata } from 'next';
import { SeoPageLayout } from '@/components/seo-page-layout';
import { ContactSection } from '@/components/landing/contact-section';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'যোগাযোগ করুন - Midman',
  description: 'Midman (মিডম্যান) এর সাথে যোগাযোগ করুন। প্রশ্ন, মতামত বা সাহায্যের জন্য আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন। Midman সাপোর্ট সবসময় আপনার পাশে।',
  keywords: ['midman contact', 'মিডম্যান যোগাযোগ', 'midman support', 'এসক্রো সাপোর্ট', 'নিরাপদ লেনদেন সাহায্য'],
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'যোগাযোগ করুন',
    description: 'যেকোনো প্রশ্ন, সমস্যা বা সহযোগিতার জন্য Midman-এর সাপোর্ট টিমের সাথে যোগাযোগ করুন।',
    url: `${SITE_URL}/contact`,
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
    { '@type': 'ListItem', position: 2, name: 'যোগাযোগ', item: `${SITE_URL}/contact` },
  ],
};

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <SeoPageLayout title="যোগাযোগ করুন" subtitle="যেকোনো প্রশ্ন, সমস্যা বা সহযোগিতার জন্য আমাদের সাথে যোগাযোগ করুন।">
        <ContactSection />
      </SeoPageLayout>
    </>
  );
}