import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'যোগাযোগ - আমাদের সাথে যোগাযোগ করুন',
  description: 'AmarDeal (আমারডিল) এর সাথে যোগাযোগ করুন। প্রশ্ন, মতামত বা সাহায্যের জন্য আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন। Amar Deal সাপোর্ট সবসময় আপনার পাশে।',
  keywords: ['amardeal contact', 'আমারডিল যোগাযোগ', 'amar deal support', 'এসক্রো সাপোর্ট', 'নিরাপদ লেনদেন সাহায্য'],
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'যোগাযোগ | AmarDeal আমারডিল',
    description: 'আমাদের সাথে যোগাযোগ করুন - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/contact`,
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
    { '@type': 'ListItem', position: 2, name: 'যোগাযোগ', item: `${SITE_URL}/contact` },
  ],
};

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <AppShell initialView="page-contact" />
    </>
  );
}