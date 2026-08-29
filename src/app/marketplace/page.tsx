import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'ডিজিটাল মার্কেটপ্লেস - নিরাপদে কিনুন ও বিক্রি করুন',
  description: 'Midman মার্কেটপ্লেসে ডিজিটাল পণ্য কিনুন ও বিক্রি করুন। সরাসরি সেলারের সাথে চ্যাট করুন বা মিডম্যান ডিলের মাধ্যমে নিরাপদে অর্ডার করুন।',
  keywords: ['digital marketplace', 'ডিজিটাল মার্কেটপ্লেস', 'ডিজিটাল পণ্য', 'online marketplace bangladesh', 'midman marketplace'],
  alternates: { canonical: `${SITE_URL}/marketplace` },
  openGraph: {
    title: 'ডিজিটাল মার্কেটপ্লেস | Midman মিডম্যান',
    description: 'ডিজিটাল পণ্য কিনুন ও বিক্রি করুন - Midman (মিডম্যান)',
    url: `${SITE_URL}/marketplace`,
    type: 'website',
    locale: 'bn_BD',
    siteName: 'Midman মিডম্যান',
  },
};

export default function MarketplacePage() {
  return <AppShell />;
}
