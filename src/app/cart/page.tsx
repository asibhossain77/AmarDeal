import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

/**
 * /cart — the Marketplace cart page.
 *
 * The cart is per-device client state (lib/cart-store.ts), so there is nothing
 * to index: the page renders the shared AppShell which restores the
 * 'page-cart' view from the URL via lib/url-sync.ts.
 */
export const metadata: Metadata = {
  title: 'কার্ট - Midman মিডম্যান',
  description: 'আপনার Midman মার্কেটপ্লেস কার্ট — পছন্দের ডিজিটাল পণ্য অর্ডার করুন।',
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return <AppShell />;
}
