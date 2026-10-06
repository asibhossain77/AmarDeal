'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, type DealStatus } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Inbox, Copy, Check, Search, X, MessageSquare, User } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { DealUnreadBadge } from '@/components/dashboard/deal-unread-badge';
import { cdnUrl } from '@/lib/cdn-url';

const emptySubscribe = () => () => {};

interface DealParticipant {
  id: string;
  name: string;
  email: string;
  phone: string;
  imageLink?: string | null;
}

interface DealRow {
  id: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  unreadCount?: number;
  hasUpdate?: boolean;
  rejectionReason?: string | null;
  buyerId?: string;
  sellerId?: string | null;
  creatorId?: string;
  buyer?: DealParticipant | null;
  seller?: DealParticipant | null;
  creator?: { id: string; name: string; email: string } | null;
}

/**
 * The other participant of a deal, from the viewer's perspective.
 * - kind 'partner'  → avatar + name + role to render
 * - kind 'awaiting' → deal has no counterparty assigned yet
 * - null            → no displayable counterparty (defensive; never the viewer themself)
 */
type DealPartnerInfo =
  | { kind: 'partner'; name: string; imageLink: string | null; role: 'buyer' | 'seller' }
  | { kind: 'awaiting' }
  | null;

/**
 * Resolve the OTHER participant of a deal for the logged-in viewer:
 * buyer sees the seller, seller sees the buyer. Legacy creator-only rows
 * fall back to the buyer. Never returns the viewer's own identity.
 */
function getDealPartner(deal: DealRow, viewerId?: string): DealPartnerInfo {
  if (!viewerId) return null;
  const buyerId = deal.buyerId ?? deal.buyer?.id;
  const sellerId = deal.sellerId ?? deal.seller?.id ?? null;

  // Viewer is the buyer → the other party is the seller.
  if (buyerId === viewerId) {
    if (deal.seller && deal.seller.id !== viewerId) {
      return { kind: 'partner', name: deal.seller.name, imageLink: deal.seller.imageLink ?? null, role: 'seller' };
    }
    return { kind: 'awaiting' };
  }
  // Viewer is the seller → the other party is the buyer.
  if (sellerId && sellerId === viewerId) {
    if (deal.buyer && deal.buyer.id !== viewerId) {
      return { kind: 'partner', name: deal.buyer.name, imageLink: deal.buyer.imageLink ?? null, role: 'buyer' };
    }
    return null;
  }
  // Legacy creator-only row (viewer is neither buyer nor seller) → buyer is the counterparty.
  if (deal.buyer && deal.buyer.id !== viewerId) {
    return { kind: 'partner', name: deal.buyer.name, imageLink: deal.buyer.imageLink ?? null, role: 'buyer' };
  }
  return null;
}

function formatDealDate(iso: string) {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function getStatusBadge(status: string, t: (key: any) => string) {
  switch (status) {
    case 'created':
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 font-medium">{t('status.created')}</Badge>;
    case 'payment_pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">{t('status.paymentPending')}</Badge>;
    case 'payment_verified':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium">{t('status.verified')}</Badge>;
    case 'in_delivery':
      return <Badge className="bg-primary/15 text-primary dark:bg-primary/20 border-0 font-medium">{t('status.inDelivery')}</Badge>;
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium">{t('status.completed')}</Badge>;
    case 'cancelled':
      return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0 font-medium">{t('status.cancelled')}</Badge>;
    case 'disputed':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">{t('status.disputed')}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Circular profile image of the deal partner with a clean initial-letter
 * fallback (same design language as the admin UserAvatar) and a broken-image
 * safety net. 36px in tables, 40px in cards.
 */
function PartnerAvatar({ name, imageLink, size }: { name: string; imageLink: string | null; size: 'sm' | 'md' }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : cdnUrl(imageLink);
  const dim = size === 'md' ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs';
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ring-1 ring-border/60 ${dim}`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary ring-1 ring-inset ring-primary/20 ${dim}`}
    >
      {(name || '?').trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function AwaitingAvatar() {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/30 text-muted-foreground/60"
    >
      <User className="h-4 w-4" />
    </div>
  );
}

/**
 * Partner cell content: avatar + name + role pill, or the awaiting/empty
 * placeholder. `compact` = table row sizing, default = card sizing.
 */
function PartnerInfo({ partner, t, compact }: { partner: DealPartnerInfo; t: (key: any) => string; compact?: boolean }) {
  if (!partner) {
    return <span className={compact ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>—</span>;
  }
  if (partner.kind === 'awaiting') {
    return (
      <div className="flex items-center gap-2.5">
        <AwaitingAvatar />
        <span className={compact ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
          {t('deals.awaitingSeller')}
        </span>
      </div>
    );
  }
  const name = partner.name?.trim() || t('deals.fallbackName');
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PartnerAvatar name={name} imageLink={partner.imageLink} size={compact ? 'sm' : 'md'} />
      <div className="min-w-0 leading-tight">
        <p className={`truncate font-semibold text-foreground ${compact ? 'max-w-[120px] text-xs' : 'max-w-[150px] text-sm'}`} title={name}>
          {name}
        </p>
        <span className="mt-0.5 inline-flex items-center rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold leading-none text-muted-foreground">
          {partner.role === 'seller' ? t('deals.roleSeller') : t('deals.roleBuyer')}
        </span>
      </div>
    </div>
  );
}

function CopyIdChip({ deal, copied, onCopy, title }: { deal: DealRow; copied: boolean; onCopy: (id: string) => void; title: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onCopy(deal.id); }}
      title={title}
      aria-label={`${title} DL-${deal.id.slice(-5)}`}
      className="group inline-flex min-h-[32px] items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 transition-colors hover:bg-muted"
    >
      <span className="font-mono text-xs font-semibold text-primary">{`DL-${deal.id.slice(-5)}`}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground" />
      )}
    </button>
  );
}

export function MyDealsPanel() {
  const user = useAppStore((s) => s.user);
  const setDashboardPanel = useAppStore((s) => s.setDashboardPanel);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'updates' | 'active' | 'pending_confirm' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const t = useT();

  const fetchDeals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data: DealRow[] = await res.json();
        setDeals(data);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleOpenDeal = (deal: DealRow) => {
    useAppStore.getState().setActiveDeal({
      id: deal.id,
      title: deal.title,
      amount: deal.amount,
      status: deal.status as DealStatus,
      createdAt: deal.createdAt,
      buyerId: deal.buyer?.id,
      sellerId: deal.seller?.id,
      creatorId: deal.creator?.id,
      buyerName: deal.buyer?.name,
      sellerName: deal.seller?.name,
      rejectionReason: deal.rejectionReason,
    });
    setDashboardPanel('deal-detail');
  };

  const filteredDeals = deals.filter((d) => {
    // Status filter
    if (filter === 'updates') {
      // শুধু আপডেট হওয়া ডিল: নতুন মেসেজ বা ডিল স্টেটাস/ডেটা পরিবর্তন হলে hasUpdate জ্বলে
      if (!d.hasUpdate) return false;
    }
    if (filter === 'pending_confirm') {
      // সেলার কাজ শেষ করেছে (in_delivery) কিন্তু বায়ার এখনো "কাজ পেয়েছি" ক্লিক করেনি
      if (d.status !== 'in_delivery') return false;
    }
    if (filter === 'active') {
      if (!['created', 'payment_pending', 'payment_verified', 'in_delivery'].includes(d.status)) return false;
    }
    if (filter === 'completed') {
      if (d.status !== 'completed') return false;
    }
    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const shortId = 'dl-' + d.id.slice(-5).toLowerCase();
      const fullId = d.id.toLowerCase();
      const title = d.title.toLowerCase();
      if (!shortId.includes(q) && !fullId.includes(q) && !title.includes(q)) return false;
    }
    return true;
  });

  const handleCopyId = (dealId: string) => {
    const shortId = 'DL-' + dealId.slice(-5);
    navigator.clipboard.writeText(shortId).then(() => {
      setCopiedId(dealId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (!mounted) return null;

  // Per-tab live counts so the user sees how many deals each category holds
  const tabCount = (tab: 'all' | 'updates' | 'active' | 'pending_confirm' | 'completed') => {
    switch (tab) {
      case 'updates': return deals.filter((d) => d.hasUpdate).length;
      case 'pending_confirm': return deals.filter((d) => d.status === 'in_delivery').length;
      case 'active': return deals.filter((d) => ['created', 'payment_pending', 'payment_verified', 'in_delivery'].includes(d.status)).length;
      case 'completed': return deals.filter((d) => d.status === 'completed').length;
      default: return deals.length;
    }
  };

  const tableHeadCls = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="text-center lg:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('deals.myDeals')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('deals.myDealsDesc')}</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('deals.searchPlaceholder')}
          className="w-full h-10 rounded-xl border border-border/50 bg-white dark:bg-zinc-900 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 shadow-lg"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('deals.searchPlaceholder')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'updates', 'active', 'pending_confirm', 'completed'] as const).map((tab) => {
          const n = tabCount(tab);
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                filter === tab
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-white dark:bg-zinc-900 text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground shadow-lg'
              }`}
            >
              <span>
                {tab === 'all' ? t('deals.all')
                  : tab === 'updates' ? t('deals.updates')
                  : tab === 'active' ? t('status.active')
                  : tab === 'pending_confirm' ? t('deals.pendingConfirm')
                  : t('status.completed')}
              </span>
              {n > 0 && (
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
                    filter === tab ? 'bg-white/25' : 'bg-muted'
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingAnimation size="lg" />
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-6 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search.trim() ? t('deals.searchNoResult', { search }) : t('deals.noDealFound')}
          </p>
        </div>
      ) : (
        <>
          {/* ── Desktop (lg+): responsive table ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="hidden overflow-hidden rounded-2xl border border-border/50 bg-white shadow-lg lg:block dark:bg-zinc-900"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className={`h-11 pl-5 ${tableHeadCls}`}>{t('deals.colDealId')}</TableHead>
                  <TableHead className={`h-11 ${tableHeadCls}`}>{t('deals.colDate')}</TableHead>
                  <TableHead className={`h-11 ${tableHeadCls}`}>{t('deals.colTitle')}</TableHead>
                  <TableHead className={`h-11 ${tableHeadCls}`}>{t('deals.colPartner')}</TableHead>
                  <TableHead className={`h-11 text-right ${tableHeadCls}`}>{t('deals.colAmount')}</TableHead>
                  <TableHead className={`h-11 ${tableHeadCls}`}>{t('deals.colStatus')}</TableHead>
                  <TableHead className={`h-11 pr-5 text-right ${tableHeadCls}`}>{t('deals.colAction')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal) => {
                  const partner = getDealPartner(deal, user?.id);
                  return (
                    <TableRow key={deal.id} className="border-border/50">
                      <TableCell className="pl-5">
                        <CopyIdChip deal={deal} copied={copiedId === deal.id} onCopy={handleCopyId} title={t('deals.copy')} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDealDate(deal.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground" title={deal.title}>{deal.title}</p>
                          <DealUnreadBadge
                            unreadCount={deal.unreadCount ?? 0}
                            hasUpdate={!!deal.hasUpdate}
                            updateLabel={t('deals.unreadUpdate')}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <PartnerInfo partner={partner} t={t} compact />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-bold text-primary">
                        ৳{deal.amount.toLocaleString('en')}
                      </TableCell>
                      <TableCell>{getStatusBadge(deal.status, t)}</TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-2">
                          {deal.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDashboardPanel('review')}
                              title={t('review.leaveReview')}
                              aria-label={t('review.leaveReview')}
                              className="h-8 w-8 rounded-lg p-0"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleOpenDeal(deal)}
                            className="h-8 gap-1.5 rounded-lg text-xs font-semibold shadow-md shadow-primary/20"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t('deals.view')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>

          {/* ── Mobile / tablet (< lg): cards ── */}
          <div className="space-y-3 lg:hidden">
            {filteredDeals.map((deal, i) => {
              const partner = getDealPartner(deal, user?.id);
              return (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-4 sm:p-5 border border-border/50"
                >
                  {/* Top row: deal ID + status */}
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CopyIdChip deal={deal} copied={copiedId === deal.id} onCopy={handleCopyId} title={t('deals.copy')} />
                      <DealUnreadBadge
                        unreadCount={deal.unreadCount ?? 0}
                        hasUpdate={!!deal.hasUpdate}
                        updateLabel={t('deals.unreadUpdate')}
                      />
                    </div>
                    {getStatusBadge(deal.status, t)}
                  </div>

                  {/* Main row: title + amount */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-base font-semibold leading-snug text-foreground">{deal.title}</p>
                    <p className="shrink-0 text-lg font-bold text-primary">৳{deal.amount.toLocaleString('en')}</p>
                  </div>

                  {/* Participant row: the OTHER party of this deal */}
                  <div className="mt-3 rounded-xl bg-muted/40 p-2.5 dark:bg-zinc-800/60">
                    <PartnerInfo partner={partner} t={t} />
                  </div>

                  {/* Bottom row: date + actions (44px touch targets) */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDealDate(deal.createdAt)}</span>
                    <div className="flex items-center gap-2">
                      {deal.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDashboardPanel('review')}
                          className="h-11 gap-1.5 rounded-lg px-3 text-xs font-semibold"
                        >
                          <MessageSquare className="h-4 w-4" />
                          {t('review.leaveReview')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleOpenDeal(deal)}
                        className="h-11 gap-1.5 rounded-lg px-4 text-xs font-semibold shadow-md shadow-primary/20"
                      >
                        <Eye className="h-4 w-4" />
                        {t('deals.view')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}
