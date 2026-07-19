import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'ড্যাশবোর্ড | AmarDeal আমারডিল',
  robots: { index: false, follow: false },
};

export default function DashboardCatchAllPage() {
  return <AppShell />;
}