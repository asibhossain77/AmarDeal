'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Gavel, Plus, Loader2, ImagePlus, X, Trophy, Users, Clock,
  Eye, Ban, ExternalLink, ImageOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';

interface SellerAuction {
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
  dealId: string | null;
  finalPrice: number | null;
  winnerName: string | null;
}

const CATEGORIES = [
  { key: 'design', bn: 'ডিজাইন', en: 'Design' },
  { key: 'development', bn: 'ডেভেলপমেন্ট', en: 'Development' },
  { key: 'content', bn: 'কন্টেন্ট', en: 'Content' },
  { key: 'marketing', bn: 'মার্কেটিং', en: 'Marketing' },
  { key: 'education', bn: 'শিক্ষা', en: 'Education' },
  { key: 'software', bn: 'সফটওয়্যার', en: 'Software' },
  { key: 'social_media', bn: 'সোশ্যাল মিডিয়া', en: 'Social Media' },
  { key: 'id', bn: 'আইডি', en: 'ID' },
  { key: 'other', bn: 'অন্যান্য', en: 'Other' },
];

function formatPrice(p: number): string {
  return '৳' + Math.round(p).toLocaleString('en-BD', { maximumFractionDigits: 0 });
}

export function AuctionsPanel() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const setDashboardPanel = useAppStore((s) => s.setDashboardPanel);
  const setView = useAppStore((s) => s.setView);
  const setAuctionDetailId = useAppStore((s) => s.setAuctionDetailId);

  /* ── My auctions list ── */
  const [auctions, setAuctions] = useState<SellerAuction[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const fetchMine = useCallback(async () => {
    try {
      const res = await fetch('/api/seller/auctions');
      const data = await res.json();
      if (data.success) setAuctions(data.auctions || []);
    } catch { /* keep */ } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { fetchMine(); }, [fetchMine]);

  /* ── Create form ── */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [startPrice, setStartPrice] = useState('');
  const [endTime, setEndTime] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // min end time: now + 10 min, formatted for datetime-local (local time)
  const minEndLocal = new Date(Date.now() + 11 * 60 * 1000 - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.url) {
        setImage(data.url);
      } else {
        toast.error(data.error || t('seller.auction.errImage'));
      }
    } catch {
      toast.error(t('seller.auction.errImage'));
    } finally {
      setUploading(false);
    }
  };

  const openDeal = (dealId: string) => {
    const a = auctions.find((x) => x.dealId === dealId);
    useAppStore.getState().setActiveDeal({
      id: dealId,
      title: a ? `${a.title} (নিলাম)` : 'নিলাম ডিল',
      amount: a?.finalPrice ?? a?.currentPrice ?? 0,
      status: 'created' as const,
      createdAt: a?.createdAt || new Date().toISOString(),
    });
    setDashboardPanel('deal-detail');
  };

  const cancelAuction = async (id: string) => {
    if (!confirm(t('seller.auction.cancelConfirm'))) return;
    try {
      const res = await fetch(`/api/auctions/${id}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(t('seller.auction.cancelled'));
        fetchMine();
      } else {
        toast.error(data.error || t('seller.auction.cancelBtn'));
      }
    } catch {
      toast.error(t('seller.auction.cancelBtn'));
    }
  };

  const openPublicPage = (id: string) => {
    setAuctionDetailId(id);
    setView('page-auction-detail');
  };

  const submit = async () => {
    if (submitting) return;
    if (title.trim().length < 3) { toast.error(t('seller.auction.errTitle')); return; }
    if (description.trim().length < 10) { toast.error(t('seller.auction.errDesc')); return; }
    const price = Number(startPrice);
    if (!Number.isFinite(price) || price < 1) { toast.error(t('seller.auction.errPrice')); return; }
    if (!endTime || new Date(endTime).getTime() < Date.now() + 10 * 60 * 1000) {
      toast.error(t('seller.auction.errTime'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          startPrice: price,
          endsAt: new Date(endTime).toISOString(),
          image,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(t('seller.auction.created'));
        setTitle(''); setDescription(''); setStartPrice(''); setEndTime(''); setImage(null); setCategory('other');
        fetchMine();
      } else {
        toast.error(data.error || t('seller.auction.submitBtn'));
      }
    } catch {
      toast.error(t('seller.auction.submitBtn'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (a: SellerAuction) => {
    switch (a.status) {
      case 'active':
        return <Badge className="rounded-full bg-primary/15 text-primary"><Clock className="mr-1 h-3 w-3" />{t('seller.auction.statusActive')}</Badge>;
      case 'sold':
        return <Badge className="rounded-full bg-primary"><Trophy className="mr-1 h-3 w-3" />{t('seller.auction.statusSold')}</Badge>;
      case 'ended':
        return <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground">{t('seller.auction.statusEnded')}</Badge>;
      default:
        return <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground"><Ban className="mr-1 h-3 w-3" />{t('seller.auction.statusCancelled')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {t('seller.auction.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('seller.auction.desc')}</p>
      </div>

      {/* ── Create form ── */}
      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6" aria-label={t('seller.auction.formTitle')}>
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
          <Gavel className="h-5 w-5 text-primary" /> {t('seller.auction.formTitle')}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="auc-title" className="mb-1.5 block text-[13px] font-medium text-foreground">{t('seller.auction.titleLabel')}</label>
            <Input id="auc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('seller.auction.titlePh')} className="h-11 rounded-xl" maxLength={150} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="auc-desc" className="mb-1.5 block text-[13px] font-medium text-foreground">{t('seller.auction.descLabel')}</label>
            <Textarea id="auc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('seller.auction.descPh')} className="min-h-[100px] rounded-xl" maxLength={5000} />
          </div>

          <div>
            <label htmlFor="auc-cat" className="mb-1.5 block text-[13px] font-medium text-foreground">{t('seller.auction.categoryLabel')}</label>
            <select id="auc-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{locale === 'bn' ? c.bn : c.en}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="auc-price" className="mb-1.5 block text-[13px] font-medium text-foreground">{t('seller.auction.startPriceLabel')}</label>
            <Input id="auc-price" type="number" inputMode="numeric" min={1} value={startPrice} onChange={(e) => setStartPrice(e.target.value)} placeholder={t('seller.auction.startPricePh')} className="h-11 rounded-xl" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="auc-end" className="mb-1.5 block text-[13px] font-medium text-foreground">{t('seller.auction.endTimeLabel')}</label>
            <Input id="auc-end" type="datetime-local" min={minEndLocal} value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-11 rounded-xl" />
          </div>

          {/* ── Image ── */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('seller.auction.imageLabel')}</label>
            {image ? (
              <div className="relative w-fit">
                <img src={cdnUrl(image) || ''} alt={title || 'auction'} className="h-32 w-48 rounded-xl border border-border/50 object-cover" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white shadow-md"
                  aria-label="remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label
                className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 bg-accent/30 text-sm text-muted-foreground transition-colors hover:bg-accent/50 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
              >
                {uploading ? (
                  <><Loader2 className="h-5 w-5 animate-spin text-primary" /> {t('seller.auction.imageUploading')}</>
                ) : (
                  <><ImagePlus className="h-5 w-5 text-primary" /> {t('seller.auction.imageHint')}</>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <Button
          onClick={submit}
          disabled={submitting || uploading}
          className="mt-5 h-12 w-full gap-2 rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 sm:w-auto sm:px-8"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitting ? t('seller.auction.submitting') : t('seller.auction.submitBtn')}
        </Button>
      </section>

      {/* ── My auctions ── */}
      <section aria-label={t('seller.auction.myTitle')}>
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          {t('seller.auction.myTitle')}
          {!loadingList && auctions.length > 0 && (
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              {t('seller.auction.count', { count: auctions.length })}
            </span>
          )}
        </h2>

        {loadingList ? (
          <div className="mt-4 space-y-3" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : auctions.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-border/70 py-10 text-center">
            <Gavel className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-semibold text-foreground">{t('seller.auction.none')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('seller.auction.noneDesc')}</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {auctions.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center">
                {/* thumb */}
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-16 sm:w-24">
                  {a.image ? (
                    <img src={cdnUrl(a.image) || ''} alt={a.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-5 w-5 text-muted-foreground/40" /></div>
                  )}
                </div>

                {/* info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(a)}
                    <span className="text-xs text-muted-foreground">
                      {a.status === 'active'
                        ? `${t('auction.endsIn')}: ${new Date(a.endsAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
                        : `${new Date(a.endsAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' })}`}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{a.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-bold tabular-nums text-foreground">
                      {a.currentPrice != null ? formatPrice(a.currentPrice) : formatPrice(a.startPrice)}
                    </span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t('auction.bidsCount', { count: a.bidCount })}</span>
                    {a.status === 'sold' && a.winnerName && (
                      <span className="flex items-center gap-1 font-medium text-primary"><Trophy className="h-3 w-3" /> {t('seller.auction.winner')}: {a.winnerName}</span>
                    )}
                    {a.status === 'active' && a.bidCount === 0 && <span>{t('seller.auction.noBidYet')}</span>}
                  </div>
                </div>

                {/* actions */}
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openPublicPage(a.id)} className="h-9 gap-1.5 rounded-xl text-xs font-semibold">
                    <Eye className="h-3.5 w-3.5" /> {t('seller.auction.viewPublic')}
                  </Button>
                  {a.dealId && (
                    <Button size="sm" onClick={() => openDeal(a.dealId!)} className="h-9 gap-1.5 rounded-xl text-xs font-semibold">
                      <ExternalLink className="h-3.5 w-3.5" /> {t('seller.auction.viewDeal')}
                    </Button>
                  )}
                  {a.status === 'active' && a.bidCount === 0 && (
                    <Button variant="outline" size="sm" onClick={() => cancelAuction(a.id)} className="h-9 gap-1.5 rounded-xl border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/10">
                      <Ban className="h-3.5 w-3.5" /> {t('seller.auction.cancelBtn')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
