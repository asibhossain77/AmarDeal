import type { Metadata } from 'next';
import { SeoPageLayout } from '@/components/seo-page-layout';
import { NotificationsView } from '@/components/notifications/notifications-view';

const SITE_URL = 'https://midman.bd';

export const metadata: Metadata = {
  title: 'নোটিফিকেশন - Midman',
  description: 'আপনার Midman একাউন্টের ডিল, পেমেন্ট, চ্যাট ও সিস্টেম নোটিফিকেশন দেখুন।',
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/notifications` },
};

export default function NotificationsPage() {
  return (
    <SeoPageLayout title="নোটিফিকেশন">
      <NotificationsView />
    </SeoPageLayout>
  );
}
