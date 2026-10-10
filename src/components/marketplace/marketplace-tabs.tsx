'use client';

/**
 * Marketplace page tabs — SMM Services (admin-owned store, default)
 * and the existing Digital Products marketplace (unchanged).
 * Keeps both experiences accessible from the same route.
 */

import { useState } from 'react';
import { Zap, Package } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { ServicesStoreSection } from './services-store';
import { MarketplaceSection } from '@/components/landing/marketplace-section';

export function MarketplaceTabs() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const [tab, setTab] = useState<'services' | 'products'>('services');

  const tabs: Array<{ key: 'services' | 'products'; label: string; Icon: React.ElementType }> = [
    { key: 'services', label: locale === 'bn' ? 'এসএমএম সার্ভিস' : 'SMM Services', Icon: Zap },
    { key: 'products', label: locale === 'bn' ? 'ডিজিটাল প্রোডাক্ট' : 'Digital Products', Icon: Package },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label={locale === 'bn' ? 'মার্কেটপ্লেস ট্যাব' : 'Marketplace tabs'}
        className="inline-flex w-full items-center gap-1 rounded-xl border border-border/40 bg-muted/40 p-1 sm:w-auto dark:border-border/25"
      >
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-all sm:flex-none sm:px-5 ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'services' ? <ServicesStoreSection /> : <MarketplaceSection />}
      <span className="sr-only">{t('page.marketplace.title')}</span>
    </div>
  );
}
