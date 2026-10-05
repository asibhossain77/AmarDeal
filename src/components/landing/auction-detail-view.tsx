'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Gavel, Clock, Users, ShieldCheck, Trophy, ImageOff, Loader2,
  CalendarDays, User, HandCoins, Zap, Ban, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { PageWrapper } from './page-wrapper';

interface BidRow {
  id: string;
  amount: number;
  createdAt: string;
  bidderName: string;
  isMine: boolean;
}

interface AuctionDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  startPrice: number;
  currentPrice: number | null;
  bidCount: number;
  status: string;
  endsAt: string;
  createdAt: string;
  minNextBid: number | null;
  seller: { id: string; name: string; imageLink: string | null };
  bids: BidRow[];
  winnerName: string | null;
  dealId: string | null;
  viewer: { isOwner: boolean; isWinner: boolean; isHighestBidder: boolean; loggedIn: boolean };
}

function formatPrice(p: number): string {
  return '৳' + Math.round(p).toLocaleString('en-BD', { maximumFractionDigits: 0 });
}

function timeAgoOf(iso: string, now: number, locale: string): string {
  const s = Math.max(1, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return locale === 'bn' ? `${s} সেকেন্ড আগে` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return locale === 'bn' ? `${m} মিনিট আগে` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return locale === 'bn' ? `${h} ঘণ্টা আগে` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return locale === 'bn' ? `${d} দিন আগে` : `${d}d ago`;
}

export function AuctionDetailView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const auctionDetailId = useAppStore((s) => s.auctionDetailId);
  const setView = useAppStore((s) => s.setView);
  const user = useAppStore((s) => s.user);

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bidInput, setBidInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fetchedOnce = useRef(false);

  const fetchDetail = useCallback(async (silent = false) => {
    const id = useAppStore.getState().auctionDetailId;
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/auctions/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setAuction(data.auction);
        setNotFound(false);
      }
    } catch {
      if (!silent) toast.error(t('auction.errorLoad'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    fetchDetail();
  }, [fetchDetail]);

  // 1s tick for countdown + relative times
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Live updates while the auction is active
  const isActive = auction?.status === 'active';
  useEffect(() => {
    if (!isActive) return;
    const poll = setInterval(() => fetchDetail(true), 15000);
    return () => clearInterval(poll);
  }, [isActive, fetchDetail]);

  // Countdown reached zero → fetch once to trigger lazy finalize + refresh result
  const [fetchedAtEnd, setFetchedAtEnd] = useState(false);
  useEffect(() => {
    if (!auction || auction.status !== 'active') return;
    if (new Date(auction.endsAt).getTime() <= now && !fetchedAtEnd) {
      setFetchedAtEnd(true);
      toast(t('auction.justEnded'));
      // small delay so the server clock has passed endsAt too
      const to = setTimeout(() => { fetchDetail(true); }, 1500);
      return () => clearTimeout(to);
    }
    if (auction.status !== 'active') setFetchedAtEnd(false);
  }, [auction, now, fetchedAtEnd, fetchDetail]);

  const handleBack = () => setView('page-auction');

  const openSellerProfile = (sellerId: string) => {
    const store = useAppStore.getState();
    store.setSellerProfileId(sellerId);
    store.setView('page-seller-profile');
  };

  const trackDeal = () => {
    if (!auction?.dealId) return;
    const store = useAppStore.getState();
    store.setActiveDeal({
      id: auction.dealId,
      title: `${auction.title} (নিলাম)`,
      amount: auction.currentPrice ?? auction.startPrice,
      status: 'created' as const,
      createdAt: auction.createdAt,
    });
    store.setDashboardPanel('deal-detail');
    store.setView('dashboard');
  };

  const placeBid = async (amount?: number) => {
    if (!auction || submitting) return;
    const value = amount ?? Number(bidInput);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t('seller.auction.errPrice'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auctions/${auction.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(t('auction.bidSuccess'));
        setBidInput('');
        await fetchDetail(true);
      } else {
        toast.error(data.error || t('auction.bidFailed'));
        if (data.minBid) setBidInput(String(data.minBid));
        await fetchDetail(true);
      }
    } catch {
      toast.error(t('auction.bidFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ── */
  if (loading) {
    return (
      <PageWrapper title={t('page.auction.title')}>
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-64 rounded-2xl bg-muted" />
          <div className="h-8 w-2/3 rounded bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
        </div>
      </PageWrapper>
    );
  }

  if (notFound || !auction) {
    return (
      <PageWrapper title={t('page.auction.title')}>
        <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
          <Gavel className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 font-semibold text-foreground">{t('auction.notFound')}</p>
          <Button onClick={handleBack} variant="outline" className="mt-4 gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> {t('auction.backToList')}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const price = auction.currentPrice ?? auction.startPrice;
  const minBid = auction.minNextBid;
  const quickBids = minBid != null ? [minBid, minBid + 50, minBid + 200] : [];
  const canBid = auction.status === 'active' && auction.viewer.loggedIn && !auction.viewer.isOwner && !!user;
  const showBidBox = auction.status === 'active';

  // Countdown segments
  let segs: { label: string; value: number }[] | null = null;
  if (auction.status === 'active') {
    const ms = Math.max(0, new Date(auction.endsAt).getTime() - now);
    const s = Math.floor(ms / 1000);
    segs = [
      { label: t('auction.dDays'), value: Math.floor(s / 86400) },
      { label: t('auction.dHours'), value: Math.floor((s % 86400) / 3600) },
      { label: t('auction.dMinutes'), value: Math.floor((s % 3600) / 60) },
      { label: t('auction.dSeconds'), value: s % 60 },
    ];
  }
  const urgent = auction.status === 'active' && new Date(auction.endsAt).getTime() - now < 60 * 60 * 1000;

  return (
    <PageWrapper title={t('page.auction.title')}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ── Back ── */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('auction.backToList')}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid gap-5 md:grid-cols-2"
        >
          {/* ── Image ── */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/60 bg-muted md:aspect-auto md:min-h-[320px]">
            {auction.image ? (
              <img src={cdnUrl(auction.image) || ''} alt={auction.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {auction.status === 'active' && (
                  <Badge className="gap-1 rounded-full bg-primary/15 text-primary">
                    <Zap className="h-3 w-3" /> {t('auction.statusActive')}
                  </Badge>
                )}
                {auction.status === 'sold' && (
                  <Badge className="gap-1 rounded-full bg-primary">
                    <Trophy className="h-3 w-3" /> {t('auction.soldChip')}
                  </Badge>
                )}
                {auction.status === 'ended' && (
                  <Badge variant="secondary" className="gap-1 rounded-full bg-muted text-muted-foreground">
                    <Clock className="h-3 w-3" /> {t('auction.endedChip')}
                  </Badge>
                )}
                {auction.status === 'cancelled' && (
                  <Badge variant="secondary" className="gap-1 rounded-full bg-muted text-muted-foreground">
                    <XCircle className="h-3 w-3" /> {t('auction.cancelledChip')}
                  </Badge>
                )}
                <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                  <CalendarDays className="mr-1 h-3 w-3" />
                  {t('auction.listedOn')} {new Date(auction.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' })}
                </Badge>
              </div>
              <h1 className="mt-3 text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
                {auction.title}
              </h1>
            </div>

            {/* ── Price + countdown card ── */}
            <div className={`rounded-2xl border p-4 sm:p-5 ${urgent && auction.status === 'active' ? 'border-red-500/40 bg-red-500/5' : 'border-border/60 bg-accent/30'}`}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {auction.currentPrice != null ? t('auction.currentBid') : t('auction.startingPrice')}
                  </p>
                  <p className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {formatPrice(price)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {t('auction.bidsCount', { count: auction.bidCount })}
                  </span>
                  {minBid != null && (
                    <span className="text-xs text-muted-foreground">
                      {t('auction.minNextBid')}: <span className="font-semibold text-foreground">{formatPrice(minBid)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown */}
              {segs ? (
                <div className="mt-4">
                  <p className={`flex items-center gap-1.5 text-xs font-semibold ${urgent ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    <Clock className="h-3.5 w-3.5" /> {t('auction.endsIn')}
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {segs.map(({ label, value }, i) => (
                      <div key={i} className="rounded-xl bg-background/80 py-2 text-center dark:bg-background/50">
                        <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">{String(value).padStart(2, '0')}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-muted-foreground">{t('auction.closed')}</p>
              )}
            </div>

            {/* ── Winner banner ── */}
            {auction.status === 'sold' && (
              <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    {auction.viewer.isWinner ? (
                      <p className="text-sm font-bold text-foreground">{t('auction.youWon')}</p>
                    ) : (
                      <p className="text-sm font-bold text-foreground">
                        {t('auction.wonBy')}: {auction.winnerName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('auction.finalPrice')}: <span className="font-semibold text-foreground">{formatPrice(price)}</span>
                    </p>
                  </div>
                </div>
                {(auction.viewer.isWinner || auction.viewer.isOwner) && auction.dealId && (
                  <Button onClick={trackDeal} className="h-10 gap-2 rounded-xl text-sm font-semibold">
                    <HandCoins className="h-4 w-4" />
                    {auction.viewer.isWinner ? t('auction.trackDeal') : t('auction.viewDeal')}
                  </Button>
                )}
              </div>
            )}

            {auction.status === 'ended' && (
              <div className="rounded-2xl border border-border/60 bg-accent/30 p-4 text-sm font-medium text-muted-foreground">
                {t('auction.noBidsEnded')}
              </div>
            )}

            {auction.status === 'cancelled' && (
              <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-accent/30 p-4 text-sm font-medium text-muted-foreground">
                <Ban className="h-4 w-4" /> {t('auction.cancelledChip')}
              </div>
            )}

            {/* ── Bid box ── */}
            {showBidBox && (
              <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                {canBid ? (
                  <>
                    {auction.viewer.isHighestBidder && (
                      <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                        <Trophy className="h-4 w-4" /> {t('auction.youAreWinning')}
                      </p>
                    )}
                    <label htmlFor="bid-input" className="mb-1.5 block text-[13px] font-medium text-foreground">
                      {t('auction.yourBid')}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="bid-input"
                        type="number"
                        inputMode="numeric"
                        min={minBid ?? 1}
                        value={bidInput}
                        onChange={(e) => setBidInput(e.target.value)}
                        placeholder={minBid ? String(minBid) : ''}
                        className="h-11 flex-1 rounded-xl text-base font-semibold tabular-nums"
                      />
                      <Button
                        onClick={() => placeBid()}
                        disabled={submitting || !bidInput}
                        className="h-11 gap-2 rounded-xl px-5 text-sm font-semibold"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
                        {submitting ? t('auction.bidding') : t('auction.bidCta')}
                      </Button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {quickBids.map((qb, i) => (
                        <button
                          key={i}
                          onClick={() => placeBid(qb)}
                          disabled={submitting}
                          className="rounded-full border border-border/70 bg-accent/40 px-3 py-1.5 text-xs font-semibold tabular-nums text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        >
                          {formatPrice(qb)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : auction.viewer.isOwner ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" /> {t('auction.ownAuction')}
                  </p>
                ) : !auction.viewer.loggedIn ? (
                  <Button
                    onClick={() => setView('auth')}
                    className="h-12 w-full gap-2 rounded-xl text-sm font-semibold"
                  >
                    <Gavel className="h-4 w-4" /> {t('auction.loginToBid')}
                  </Button>
                ) : null}
              </div>
            )}

            {/* ── Seller ── */}
            <button
              onClick={() => openSellerProfile(auction.seller.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left transition-colors hover:bg-accent/40"
            >
              <Avatar className="h-10 w-10">
                {auction.seller.imageLink ? <AvatarImage src={cdnUrl(auction.seller.imageLink) || ''} alt={auction.seller.name} /> : null}
                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                  {auction.seller.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">{t('auction.sellerLabel')}</p>
                <p className="truncate text-sm font-semibold text-foreground">{auction.seller.name}</p>
              </div>
              <span className="text-xs font-medium text-primary">{t('auction.viewSellerProfile')}</span>
            </button>
          </div>
        </motion.div>

        {/* ── Description ── */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="text-base font-bold text-foreground">{t('auction.descriptionTitle')}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {auction.description}
          </p>
        </div>

        {/* ── Escrow note ── */}
        <div className="flex gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-[13px] leading-relaxed text-foreground/90">{t('auction.escrowNote')}</p>
        </div>

        {/* ── Bid history ── */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Gavel className="h-4 w-4 text-primary" /> {t('auction.bidHistory')}
          </h2>
          {auction.bids.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('auction.noBidsYet')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {auction.bids.map((b, i) => (
                <li
                  key={b.id}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 ${
                    b.isMine ? 'bg-primary/10' : i === 0 ? 'bg-accent/50' : 'bg-accent/25'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {i === 0 && auction.status === 'active' && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <span className="truncate text-sm font-medium text-foreground">
                      {b.bidderName}
                      {b.isMine && <span className="ml-1.5 text-[11px] font-semibold text-primary">({locale === 'bn' ? 'আপনি' : 'you'})</span>}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">{timeAgoOf(b.createdAt, now, locale)}</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{formatPrice(b.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
