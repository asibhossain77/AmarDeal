import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'কিভাবে কাজ করে - ধাপে ধাপে গাইড',
  description: 'AmarDeal (আমারডিল) ব্যবহার করে নিরাপদে লেনদেন করুন। মাত্র ৩টি ধাপে এসক্রো সার্ভিসের মাধ্যমে ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য সুরক্ষিত। Amar Deal এর কাজের প্রক্রিয়া জানুন।',
  keywords: ['amardeal how it works', 'আমারডিল কিভাবে কাজ করে', 'এসক্রো প্রক্রিয়া', 'নিরাপদ লেনদেন ধাপ', 'amar deal process'],
  alternates: { canonical: `${SITE_URL}/how-it-works` },
  openGraph: {
    title: 'কিভাবে কাজ করে | AmarDeal আমারডিল',
    description: 'মাত্র ৩টি ধাপে নিরাপদ লেনদেন সম্পন্ন করুন - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/how-it-works`,
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
    { '@type': 'ListItem', position: 2, name: 'কিভাবে কাজ করে', item: `${SITE_URL}/how-it-works` },
  ],
};

const howToLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'AmarDeal আমারডিল দিয়ে কিভাবে নিরাপদে লেনদেন করবেন',
  description: 'মাত্র ৩টি ধাপে AmarDeal (আমারডিল) দিয়ে নিরাপদে অনলাইন লেনদেন সম্পন্ন করুন।',
  step: [
    { '@type': 'HowToStep', name: 'ডিল তৈরি করুন', text: 'ক্রেতা ও বিক্রেতা মিলে AmarDeal এ এসক্রো ডিল তৈরি করুন। লেনদেনের শর্তাবলী স্পষ্টভাবে উল্লেখ করুন।', position: 1 },
    { '@type': 'HowToStep', name: 'টাকা জমা দিন', text: 'ক্রেতা বিকাশ, নগদ বা রকেট দিয়ে নিরাপদে এসক্রো অ্যাকাউন্টে টাকা জমা দিন। টাকা ডিল সম্পন্ন না হওয়া পর্যন্ত সম্পূর্ণ সুরক্ষিত থাকবে।', position: 2 },
    { '@type': 'HowToStep', name: 'নিরাপদে লেনদেন সম্পন্ন করুন', text: 'শর্ত পূরণ হলে বিক্রেতাকে টাকা প্রদান করা হবে। কোনো পক্ষ শর্ত ভঙ্গ করলে টাকা ক্রেতাকে ফেরত দেওয়া হবে।', position: 3 },
  ],
};

export default function HowItWorksPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <AppShell initialView="page-how-it-works" />
    </>
  );
}