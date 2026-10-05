'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gavel, Clock, Users, ImageOff, Trophy, Pencil, Zap, ShieldCheck, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';

interface AuctionCardData {
  id: string;
  title: string;
  category: string;
  image: string | null;
  startPrice: number;
  currentPrice: number | null;
  bidCount: number;
  status: string;
  endsAt: string;
  createdAt: string;
  seller: { id: string; name: string; imageLink: string | null };
}

const CATEGORY_NAMES: Record<string, { bn: string; en: string }> = {
  design: { bn: 'ডিজাইন', en: 'Design' },
  development: { bn: 'ডেভেলপমেন্ট', en: 'Development' },
  content: { bn: 'কন্টেন্ট', en: 'Content' },
  marketing: { bn: 'মার্কেটিং', en: 'Marketing' },
  education: { bn: 'শিক্ষা', en: 'Education' },
  software: { bn: 'সফটওয়্যার', en: 'Software' },
  social_media: { bn: 'সোশ্যাল মিডিয়া', en: 'Social Media' },
  id: { bn: 'আইডি', en: 'ID' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

function formatPrice(p: number): string {
  return '৳' + Math.round(p).toLocaleString('en-BD', { maximumFractionDigits: 0 });
}

/* Live "time left" text shared by list cards — ticks every second via `now` */
function timeLeftOf(endsAt: string, now: number): { text: string; urgent: boolean; expired: boolean } {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return { text: '00:00', urgent: true, expired: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let text: string;
  if (d > 0) text = `${d}দ ${String(h).padStart(2, '0')}ঘ`;
  else if (h > 0) text = `${h}ঘ ${String(m).padStart(2, '0')}মি`;
  else text = `${m}মি ${String(sec).padStart(2, '0')}সে`;
  return { text, urgent: ms < 60 * 60 * 1000, expired: false };
}

export function AuctionListView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const [tab, setTab] = useState<'active' | 'ended'>('active');
  const [items, setItems] = useState<AuctionCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const openAuction = (id: string) => {
    const store = useAppStore.getState();
    store.setAuctionDetailId(id);
    store.setView('page-auction-detail');
  };

  const fetchList = useCallback(async (whichTab: 'active' | 'ended', showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`/api/auctions?status=${whichTab}`);
      const data = await res.json();
      if (data.success) setItems(data.auctions || []);
    } catch { /* keep previous list */ } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetchList(tab, true).finally(() => { if (alive) setLoading(false); });
    // Live list: refresh while viewing active auctions
    const poll = tab === 'active' ? setInterval(() => fetchList(tab), 20000) : null;
    return () => { alive = false; if (poll) clearInterval(poll); };
  }, [tab, fetchList]);

  // 1s tick for countdown chips
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const steps = useMemo(() => ([
    { icon: Pencil, title: t('auction.step1Title'), desc: t('auction.step1Desc') },
    { icon: Trophy, title: t('auction.step2Title'), desc: t('auction.step2Desc') },
    { icon: HandCoins, title: t('auction.step3Title'), desc: t('auction.step3Desc') },
  ]), [t]);

  return (
    <section aria-label={t('page.auction.title')} className="space-y-6 sm:space-y-8">
      {/* ── Tabs ── */}
      <div className="flex gap-2">
        {([
          { key: 'active' as const, label: t('auction.tabActive') },
          { key: 'ended' as const, label: t('auction.tabEnded') },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-accent/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            {key === 'active' ? <Zap className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="aspect-[16/10] animate-pulse bg-muted" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Gavel className="h-7 w-7 text-primary" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">
            {tab === 'active' ? t('auction.empty') : t('auction.emptyEnded')}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('auction.emptyDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => {
            const tl = timeLeftOf(a.endsAt, now);
            const price = a.currentPrice ?? a.startPrice;
            const catName = CATEGORY_NAMES[a.category]?.[locale === 'bn' ? 'bn' : 'en'] || a.category;
            return (
              <motion.article
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3 }}
                className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-lg"
              >
                <button
                  onClick={() => openAuction(a.id)}
                  className="block w-full text-left"
                  aria-label={a.title}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {a.image ? (
                      <img
                        src={cdnUrl(a.image) || ''}
                        alt={a.title}
                        loading="lazy" decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageOff className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex gap-2">
                      <Badge className="rounded-full bg-background/85 text-[11px] font-semibold text-foreground backdrop-blur-sm">
                        {catName}
                      </Badge>
                      {a.status === 'sold' && (
                        <Badge className="rounded-full bg-primary text-[11px] font-semibold">
                          {t('auction.soldChip')}
                        </Badge>
                      )}
                      {a.status === 'ended' && (
                        <Badge variant="secondary" className="rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                          {t('auction.endedChip')}
                        </Badge>
                      )}
                    </div>
                    {a.status === 'active' && (
                      <div className={`absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums backdrop-blur-sm ${
                        tl.urgent ? 'bg-red-500/90 text-white' : 'bg-background/85 text-foreground'
                      }`}>
                        <Clock className="h-3 w-3" />
                        {tl.text}
                      </div>
                    )}
                    {a.status === 'sold' && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-bold text-primary-foreground backdrop-blur-sm">
                        <Trophy className="h-3 w-3" />
                        {t('auction.soldChip')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <h3 className="line-clamp-2 min-h-[2.6rem] text-[15px] font-semibold leading-snug text-foreground">
                      {a.title}
                    </h3>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {a.currentPrice != null ? t('auction.currentBid') : t('auction.startingPrice')}
                        </p>
                        <p className="text-xl font-bold tabular-nums text-foreground">{formatPrice(price)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {t('auction.bidsCount', { count: a.bidCount })}
                        </span>
                        <span className="max-w-[110px] truncate text-[11px] text-muted-foreground/80">
                          {a.seller.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                <div className="px-4 pb-4">
                  <Button
                    onClick={() => openAuction(a.id)}
                    className="h-10 w-full gap-2 rounded-xl text-sm font-semibold"
                    variant={a.status === 'active' ? 'default' : 'outline'}
                  >
                    <Gavel className="h-4 w-4" />
                    {a.status === 'active' ? t('auction.bidNow') : t('auction.viewDetails')}
                  </Button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* ── How it works ── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t('auction.howItWorksTitle')}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-accent/40 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {i + 1}. {title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
