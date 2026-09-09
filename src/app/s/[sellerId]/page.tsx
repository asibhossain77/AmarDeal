import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'সেলার প্রোফাইল',
};

export default function SellerProfilePage() {
  return <AppShell />;
}
