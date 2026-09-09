import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'সেলার প্যানেল',
  robots: { index: false, follow: false },
};

export default function SellerCatchAllPage() {
  return <AppShell />;
}