import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

// Download pages are private per-user — never index them
export const metadata: Metadata = {
  title: 'ডাউনলোড সেন্টার — Midman',
  robots: { index: false, follow: false },
};

export default function DownloadPage() {
  return <AppShell />;
}
