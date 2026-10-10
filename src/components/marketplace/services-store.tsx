'use client';

/**
 * Admin-owned SMM Services storefront.
 * Customers browse published services, filter by category and search.
 * There are NO seller CTAs here — services are created exclusively by
 * platform administrators in the admin dashboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Package, Zap, LayoutGrid, Palette, Code2, PenTool, Megaphone,
  GraduationCap, Wrench, TrendingUp, Star, Clock, ShieldCheck, ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { calculateOrderTotal } from '@/lib/marketplace-pricing';

export interface StorefrontService {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePerThousand: number;
  minQuantity: number;
  maxQuantity: number;
  linkTypes: string[];
  deliveryEstimate: string | null;
  instructions: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { key: 'all', bn: 'সব', en: 'All', Icon: LayoutGrid, color: 'text-primary' },
  { key: 'social_media', bn: 'সোশ্যাল মিডিয়া', en: 'Social Media', Icon: TrendingUp, color: 'text-green-500 dark:text-green-400' },
  { key: 'marketing', bn: 'মার্কেটিং', en: 'Marketing', Icon: Megaphone, color: 'text-purple-500 dark:text-purple-400' },
  { key: 'content', bn: 'কন্টেন্ট', en: 'Content', Icon: PenTool, color: 'text-orange-500 dark:text-orange-400' },
  { key: 'design', bn: 'ডিজাইন', en: 'Design', Icon: Palette, color: 'text-pink-500 dark:text-pink-400' },
  { key: 'development', bn: 'ডেভেলপমেন্ট', en: 'Development', Icon: Code2, color: 'text-blue-500 dark:text-blue-400' },
  { key: 'education', bn: 'শিক্ষা', en: 'Education', Icon: GraduationCap, color: 'text-amber-500 dark:text-amber-400' },
  { key: 'software', bn: 'সফটওয়্যার', en: 'Software', Icon: Wrench, color: 'text-cyan-500 dark:text-cyan-400' },
  { key: 'id', bn: 'আইডি', en: 'ID', Icon: Star, color: 'text-rose-500 dark:text-rose-400' },
];

const CATEGORY_BG: Record<string, string> = {
  design: 'from-pink-500/10 to-pink-500/5 dark:from-pink-500/15 dark:to-pink-500/5',
  development: 'from-blue-500/10 to-blue-500/5 dark:from-blue-500/15 dark:to-blue-500/5',
  content: 'from-orange-500/10 to-orange-500/5 dark:from-orange-500/15 dark:to-orange-500/5',
  marketing: 'from-purple-500/10 to-purple-500/5 dark:from-purple-500/15 dark:to-purple-500/5',
  education: 'from-amber-500/10 to-amber-500/5 dark:from-amber-500/15 dark:to-amber-500/5',
  software: 'from-cyan-500/10 to-cyan-500/5 dark:from-cyan-500/15 dark:to-cyan-500/5',
  social_media: 'from-green-500/10 to-green-500/5 dark:from-green-500/15 dark:to-green-500/5',
  id: 'from-rose-500/10 to-rose-500/5 dark:from-rose-500/15 dark:to-rose-500/5',
  other: 'from-zinc-500/10 to-zinc-500/5 dark:from-zinc-500/15 dark:to-zinc-500/5',
};

// English digits everywhere — even in Bangla locale (platform convention)
function formatPrice(price: number): string {
  return '৳' + price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getCategoryColor(category: string) {
  const cat = CATEGORIES.find((c) => c.key === category);
  return cat?.color || 'text-muted-foreground';
}

// Direct icon map — plain member access avoids creating components during render
const CATEGORY_ICONS: Record<string, React.ElementType> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.Icon]),
);

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } }),
};

// -- ServiceCard --
function ServiceCard({ service, index, onClick, locale }: { service: StorefrontService; index: number; onClick: () => void; locale: string }) {
  const CatIcon = CATEGORY_ICONS[service.category] || Package;
  const catColor = getCategoryColor(service.category);
  const gradientBg = CATEGORY_BG[service.category] || CATEGORY_BG.other;
  // Preview total at the service's minimum quantity
  const minTotal = calculateOrderTotal(service.pricePerThousand, service.minQuantity);

  return (
    <motion.article
      role="listitem"
      custom={index}
      variants={cardVariant}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-border/30 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-primary/[0.07] hover:border-primary/25 hover:-translate-y-1 dark:border-border/20"
    >
      <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradientBg} py-8`}>
        <CatIcon className={`h-11 w-11 ${catColor} opacity-40 transition-all duration-500 group-hover:scale-110 group-hover:opacity-70 sm:h-12 sm:w-12`} strokeWidth={1.2} />
        <div className="absolute left-3 top-3">
          <Badge variant="secondary" className="gap-1.5 bg-background/80 text-[10px] font-semibold backdrop-blur-lg shadow-sm dark:bg-zinc-900/80">
            <CatIcon className={`h-3 w-3 ${catColor}`} strokeWidth={2.5} />
            {CATEGORIES.find((c) => c.key === service.category)?.[locale === 'bn' ? 'bn' : 'en'] || service.category}
          </Badge>
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-primary backdrop-blur shadow-sm dark:bg-zinc-900/80">
          <ShieldCheck className="h-3 w-3" />
          {locale === 'bn' ? 'মিডম্যান সুরক্ষিত' : 'Protected'}
        </div>
      </div>
      <div className="p-3.5 sm:p-4">
        <h3 className="line-clamp-1 text-[14px] font-semibold text-foreground transition-colors group-hover:text-primary sm:text-[15px]">{service.name}</h3>
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground sm:text-[13px]">{service.description}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <span className="text-base font-extrabold text-primary sm:text-lg">{formatPrice(service.pricePerThousand)}</span>
            <span className="ml-1 text-[10px] font-medium text-muted-foreground">/ 1,000</span>
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
              {locale === 'bn' ? 'সর্বনিম্ন' : 'from'} {formatPrice(minTotal)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {service.deliveryEstimate && (
              <div className="flex items-center gap-1 text-muted-foreground/70">
                <Clock className="h-2.5 w-2.5" />
                <span className="text-[9px] sm:text-[10px]" dir="ltr">{service.deliveryEstimate}</span>
              </div>
            )}
            <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {locale === 'bn' ? 'অর্ডার করুন' : 'Order'} <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// -- ServicesStoreSection --
export function ServicesStoreSection() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const [services, setServices] = useState<StorefrontService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const fetchServices = useCallback(async (cat?: string) => {
    setLoading(true);
    try {
      const params = cat && cat !== 'all' ? `?category=${encodeURIComponent(cat)}` : '';
      const res = await fetch(`/api/marketplace/services${params}`);
      const data = await res.json();
      if (data.success) setServices(data.services || []);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices(activeCategory);
  }, [activeCategory, fetchServices]);

  const filtered = services.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()),
  );

  const openServicePage = (id: string) => {
    const store = useAppStore.getState();
    store.setServiceDetailId(id);
    store.setView('page-service');
  };

  return (
    <section aria-label={locale === 'bn' ? 'এসএমএম সার্ভিস' : 'SMM Services'} className="space-y-6 sm:space-y-8">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={locale === 'bn' ? 'সার্ভিস খুঁজুন...' : 'Search services...'}
          aria-label={locale === 'bn' ? 'সার্ভিস খুঁজুন' : 'Search services'}
          className="h-11 w-full rounded-xl border border-border/40 bg-background pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all dark:border-border/25"
        />
      </div>

      {/* Category grid */}
      <nav aria-label={locale === 'bn' ? 'ক্যাটাগরি ফিল্টার' : 'Category filter'}>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`group relative flex flex-col items-center gap-2 rounded-xl p-3 transition-all duration-200 sm:rounded-2xl sm:p-4 ${isActive ? 'bg-primary/10 border-2 border-primary/30 shadow-md shadow-primary/10' : 'bg-card border border-border/30 hover:border-primary/20 hover:shadow-sm dark:border-border/20'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 transition-colors sm:h-11 sm:w-11 sm:rounded-2xl group-hover:bg-muted ${isActive ? 'bg-primary/15' : ''}`}>
                  <cat.Icon className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${isActive ? 'text-primary' : cat.color}`} strokeWidth={1.8} />
                </div>
                <span className={`text-[11px] font-semibold leading-tight sm:text-[12px] ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>{cat[locale === 'bn' ? 'bn' : 'en']}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Heading */}
      <div className="flex items-center gap-2">
        <Zap className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
        <h2 className="text-[15px] font-bold text-foreground sm:text-base">
          {locale === 'bn' ? 'সকল সার্ভিস' : 'All Services'}
          {!loading && <span className="ml-2 text-[13px] font-normal text-muted-foreground">({filtered.length})</span>}
        </h2>
      </div>

      {/* Grid / loading / empty */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border/30 bg-card">
              <div className="h-28 bg-muted/50" />
              <div className="space-y-2.5 p-4">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="flex justify-between pt-2">
                  <div className="h-5 w-20 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {locale === 'bn' ? 'কোনো সার্ভিস পাওয়া যায়নি' : 'No services found'}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {locale === 'bn' ? 'অন্য ক্যাটাগরি বা সার্চ শব্দ দিয়ে চেষ্টা করুন' : 'Try a different category or search term'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {filtered.map((service, i) => (
            <ServiceCard
              key={service.id}
              service={service}
              index={i}
              locale={locale}
              onClick={() => openServicePage(service.id)}
            />
          ))}
        </div>
      )}
      <span className="sr-only">{t('page.marketplace.title')}</span>
    </section>
  );
}
