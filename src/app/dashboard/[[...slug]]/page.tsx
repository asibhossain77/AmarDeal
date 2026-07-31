import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'ড্যাশবোর্ড | Midman মিডম্যান',
  robots: { index: false, follow: false },
};

export default function DashboardCatchAllPage() {
  return <AppShell />;
}