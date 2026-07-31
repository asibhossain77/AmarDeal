import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'লগইন | Midman মিডম্যান',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <AppShell />;
}