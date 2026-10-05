import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'লাইভ নিলাম — বিড করুন, সর্বোচ্চ বিডারই জয়ী | Midman মিডম্যান',
  description:
    'Midman নিলামে অংশ নিন — ডিজিটাল পণ্য ও সার্ভিসে লাইভ বিড করুন। সময় শেষে সর্বোচ্চ বিডার জয়ী হন এবং বিজয়ী ও বিক্রেতার মধ্যে স্বয়ংক্রিয়ভাবে মিডম্যান এসক্রো ডিল তৈরি হয়। ১০০% নিরাপদ কেনাবেচা।',
  keywords: [
    'নিলাম',
    'অনলাইন নিলাম বাংলাদেশ',
    'লাইভ অকশন',
    'bid marketplace bangladesh',
    'online auction bd',
    'midman nilam',
    'এসক্রো নিলাম',
    'ডিজিটাল পণ্য নিলাম',
  ],
  alternates: {
    canonical: `${SITE_URL}/nilam`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'লাইভ নিলাম | Midman মিডম্যান — বিড করুন, এসক্রো সুরক্ষায় জিতুন',
    description:
      'ডিজিটাল পণ্যে লাইভ বিড করুন। সর্বোচ্চ বিডারই জয়ী — বিজয়ীর জন্য স্বয়ংক্রিয়ভাবে এসক্রো ডিল তৈরি হয়।',
    url: `${SITE_URL}/nilam`,
    type: 'website',
  },
};

export default function NilamPage() {
  return <AppShell />;
}
