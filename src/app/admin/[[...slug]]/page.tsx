import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'প্রশাসন প্যানেল | Midman মিডম্যান',
  robots: { index: false, follow: false },
};

export default function AdminCatchAllPage() {
  return <AppShell />;
}