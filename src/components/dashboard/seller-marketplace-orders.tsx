'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ShoppingBag, Clock3, Loader2, CheckCircle2, XCircle, Search, SlidersHorizontal,
  X, Eye, PackageSearch, Inbox,
} from 'lucide-react';
import {
  OrderStatusBadge, PaymentStatusBadge, OrderProductThumb, CounterpartyAvatar,
  formatTaka, formatOrderDate, type OrderLite, type OrderCounts,
} from '@/components/shared/order-utils';
import { OrderDetailsDialog, OrderDetailData, OrderDialogAction } from '@/components/shared/order-details-dialog';

/* ═══════════════════════════════════════════════════════════════
   Seller Marketplace Orders — the Orders management page.

   Title "Orders" + subtitle, five live summary cards (Total /
   Pending / Processing / Completed / Cancelled — real backend
   counts, clickable → filters the list), a full toolbar (search,
   status, date range, sort, clear), a desktop table (lg+) and
   compact order cards on mobile, plus a details dialog with the
   valid actions (Cancel unpaid / Mark Completed).

   Data comes exclusively from GET /api/orders?role=seller — the
   server hard-scopes every query to sellerId = the logged-in
   seller, so no other seller's orders can ever appear here.
   ═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['all', 'open', 'pending_payment', 'queued', 'processing', 'in_progress', 'completed', 'cancelled', 'refunded', 'disputed'] as const;

interface ListResponse {
  orders: OrderLite[];
  counts: OrderCounts;
  total: number;
  hasMore: boolean;
}

export function SellerMarketplaceOrders() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const queryClient = useQueryClient();

  // Filters
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Details dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<OrderDetailData | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Debounce search → query param
  useEffect(() => {
    const id = setTimeout(() => { setSearchQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ role: 'seller', status, sort, page: String(page), pageSize: String(PAGE_SIZE) });
    if (searchQ) p.set('q', searchQ);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p;
  }, [status, sort, page, searchQ, from, to]);

  const { data, isLoading, isFetching } = useQuery<ListResponse>({
    queryKey: ['seller-marketplace-orders', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const orders = data?.orders ?? [];
  const counts = data?.counts;
  const activeFilterCount = [status !== 'all', !!searchQ, !!from, !!to, sort !== 'newest'].filter(Boolean).length;

  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  const clearFilters = () => {
    setStatus('all'); setSearch(''); setSearchQ(''); setFrom(''); setTo(''); setSort('newest'); setPage(1);
  };

  const openDetails = async (id: string) => {
    setDetailBusy(true);
    setDetailOpen(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/marketplace/orders/${id}`);
      const json = await res.json();
      if (res.ok && json.order) setDetail(json.order as OrderDetailData);
      else toast.error(json.error || t('orders.loadFailed'));
    } catch {
      toast.error(t('orders.loadFailed'));
    } finally {
      setDetailBusy(false);
    }
  };

  const refreshList = () => {
    queryClient.invalidateQueries({ queryKey: ['seller-marketplace-orders'] });
  };

  const handleAction = async (action: OrderDialogAction, reason?: string) => {
    if (!detail || action === 'pay_now') return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/orders/${detail.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t('orders.actionDone'));
        setDetail({ ...detail, ...json.order, viewerRole: detail.viewerRole } as OrderDetailData);
        refreshList();
      } else {
        toast.error(json.error || t('orders.actionFailed'));
      }
    } catch {
      toast.error(t('orders.actionFailed'));
    } finally {
      setActionBusy(false);
    }
  };

  const summaryCards = counts ? [
    { key: 'total', label: t('orders.cardTotal'), value: counts.total, icon: ShoppingBag, color: 'text-primary', bg: 'bg-primary/10', status: 'all' },
    { key: 'pending', label: t('orders.cardPending'), value: counts.pending, icon: Clock3, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10', status: 'open' },
    { key: 'processing', label: t('orders.cardProcessing'), value: counts.processing, icon: Loader2, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10', status: 'processing' },
    { key: 'completed', label: t('orders.cardCompleted'), value: counts.completed, icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10', status: 'completed' },
    { key: 'cancelled', label: t('orders.cardCancelled'), value: counts.cancelled, icon: XCircle, color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-500/10', status: 'cancelled' },
  ] : [];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t('orders.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('orders.subtitle')}</p>
      </div>

      {/* Summary cards — compact, clickable filters */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const active = status === card.status;
          return (
            <button
              key={card.key}
              onClick={() => setFilter(() => setStatus(active && card.status !== 'all' ? 'all' : card.status))}
              aria-pressed={active}
              className={`flex items-center justify-between gap-2 rounded-2xl border bg-white p-3.5 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow dark:bg-zinc-900 ${
                active ? 'border-primary/50 ring-1 ring-primary/25' : 'border-border/60 dark:border-border/40'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{card.label}</p>
                <p className="mt-0.5 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {counts ? card.value.toLocaleString('en') : '—'}
                </p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color} ${card.key === 'processing' && isFetching ? 'animate-spin' : ''}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar — desktop */}
      <div className="mb-4 hidden flex-wrap items-center gap-2.5 lg:flex">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}
            className="h-10 rounded-xl pl-9 pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label={t('orders.clearFilters')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={(v) => setFilter(() => setStatus(v))}>
          <SelectTrigger className="h-10 w-44 rounded-xl" aria-label={t('orders.filterStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{t(statusLabelKey(s) as never)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={from} onChange={(e) => setFilter(() => setFrom(e.target.value))} aria-label={t('orders.dateFrom')} className="h-10 w-[140px] rounded-xl text-[13px]" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="date" value={to} onChange={(e) => setFilter(() => setTo(e.target.value))} aria-label={t('orders.dateTo')} className="h-10 w-[140px] rounded-xl text-[13px]" />
        </div>
        <Select value={sort} onValueChange={(v) => setFilter(() => setSort(v))}>
          <SelectTrigger className="h-10 w-40 rounded-xl" aria-label={t('orders.sort')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t('orders.sortNewest')}</SelectItem>
            <SelectItem value="oldest">{t('orders.sortOldest')}</SelectItem>
            <SelectItem value="amount_desc">{t('orders.sortAmountHigh')}</SelectItem>
            <SelectItem value="amount_asc">{t('orders.sortAmountLow')}</SelectItem>
          </SelectContent>
        </Select>
        {activeFilterCount > 0 && (
          <Button variant="ghost" onClick={clearFilters} className="h-10 gap-1.5 rounded-xl text-[13px] text-muted-foreground">
            <X className="h-4 w-4" />
            {t('orders.clearFilters')}
            <Badge variant="secondary" className="ml-0.5 border-0 bg-primary/10 text-[10px] font-bold text-primary">{activeFilterCount}</Badge>
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {data && <span>{data.total.toLocaleString('en')} {t('orders.countSuffix')}</span>}
        </div>
      </div>

      {/* Toolbar — mobile/tablet */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setFiltersOpen(true)} className="relative h-10 shrink-0 gap-1.5 rounded-xl text-[13px] font-medium">
          <SlidersHorizontal className="h-4 w-4" />
          {t('orders.filters')}
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-6 pt-4">
          <SheetHeader className="mb-3 p-0">
            <SheetTitle className="text-base font-bold">{t('orders.filters')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">{t('orders.filterStatus')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v)}>
                <SelectTrigger className="h-11 w-full rounded-xl" aria-label={t('orders.filterStatus')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{t(statusLabelKey(s) as never)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">{t('orders.dateFrom')}</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">{t('orders.dateTo')}</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl text-[13px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">{t('orders.sort')}</Label>
              <Select value={sort} onValueChange={(v) => setSort(v)}>
                <SelectTrigger className="h-11 w-full rounded-xl" aria-label={t('orders.sort')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('orders.sortNewest')}</SelectItem>
                  <SelectItem value="oldest">{t('orders.sortOldest')}</SelectItem>
                  <SelectItem value="amount_desc">{t('orders.sortAmountHigh')}</SelectItem>
                  <SelectItem value="amount_asc">{t('orders.sortAmountLow')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => { setPage(1); setFiltersOpen(false); }}
                className="h-11 flex-1 rounded-xl text-[14px] font-semibold"
              >
                {t('orders.applyFilters')}
              </Button>
              <Button
                variant="outline"
                onClick={() => { clearFilters(); }}
                className="h-11 flex-1 rounded-xl text-[14px] font-semibold"
              >
                {t('orders.clearFilters')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── List ── */}
      {isLoading ? (
        <OrderListSkeleton />
      ) : orders.length === 0 ? (
        <EmptyOrders hasFilters={activeFilterCount > 0} onClear={clearFilters} />
      ) : (
        <>
          {/* Desktop table (lg+) */}
          <div className="hidden overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm dark:border-border/40 dark:bg-zinc-900 lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {[t('orders.colOrder'), t('orders.colProduct'), t('orders.colCustomer'), t('orders.colQty'), t('orders.colTotal'), t('orders.colDate'), t('orders.colPayment'), t('orders.colStatus'), t('orders.colActions')].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${i === 1 ? 'text-left' : i === 4 ? 'text-right' : i === 8 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-3 font-mono text-[12px] font-semibold text-foreground whitespace-nowrap">
                        {o.orderNumber}
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <OrderProductThumb image={o.product.image} title={o.product.title} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-foreground">{o.product.title}</p>
                            {o.optionName && <p className="truncate text-[11px] text-muted-foreground">{o.optionName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CounterpartyAvatar name={o.counterparty?.name} imageLink={o.counterparty?.imageLink} size={26} />
                          <span className="max-w-[130px] truncate text-[13px] text-foreground">{o.counterparty?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground">{o.quantity}</td>
                      <td className="px-4 py-3 text-right text-[13px] font-bold text-foreground whitespace-nowrap">{formatTaka(o.totalAmount)}</td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{formatOrderDate(o.createdAt, locale)}</td>
                      <td className="px-4 py-3"><PaymentStatusBadge paymentStatus={o.paymentStatus} /></td>
                      <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => openDetails(o.id)} className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold">
                          <Eye className="h-3.5 w-3.5" />
                          {t('orders.viewDetails')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards (<lg) */}
          <div className="space-y-2.5 lg:hidden">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border/50 bg-white p-3.5 shadow-sm dark:border-border/40 dark:bg-zinc-900">
                {/* top row: id + date | status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-[12px] font-bold text-foreground">{o.orderNumber}</span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatOrderDate(o.createdAt, locale)}</p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
                {/* product */}
                <div className="mt-2.5 flex items-center gap-2.5">
                  <OrderProductThumb image={o.product.image} title={o.product.title} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-semibold text-foreground">{o.product.title}</p>
                    {o.optionName && <p className="truncate text-[11px] text-muted-foreground">{o.optionName}</p>}
                  </div>
                </div>
                {/* customer + qty */}
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                  <CounterpartyAvatar name={o.counterparty?.name} imageLink={o.counterparty?.imageLink} size={22} />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{o.counterparty?.name || '—'}</span>
                  <span className="text-[11px] text-muted-foreground">{t('orders.colQty')}: {o.quantity}</span>
                </div>
                {/* amount + payment + action */}
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-extrabold text-primary">{formatTaka(o.totalAmount)}</span>
                    <PaymentStatusBadge paymentStatus={o.paymentStatus} />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openDetails(o.id)} className="h-9 gap-1.5 rounded-lg px-3 text-[12px] font-semibold">
                    <Eye className="h-3.5 w-3.5" />
                    {t('orders.viewDetails')}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {data?.hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={isFetching} className="h-10 gap-2 rounded-xl px-6 text-[13px] font-semibold">
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('orders.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Details dialog */}
      <OrderDetailsDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        order={detail}
        busy={actionBusy || detailBusy}
        onAction={handleAction}
      />
    </div>
  );
}

function statusLabelKey(s: string): string {
  if (s === 'all') return 'orders.filterAll';
  if (s === 'open') return 'orders.cardPending';
  return `orderStatus.${s}`;
}

function EmptyOrders({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
        {hasFilters ? <PackageSearch className="h-7 w-7 text-muted-foreground/50" /> : <Inbox className="h-7 w-7 text-muted-foreground/50" />}
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">
        {hasFilters ? t('orders.emptyFilteredTitle') : t('orders.emptyTitle')}
      </p>
      <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
        {hasFilters ? t('orders.emptyFilteredDesc') : t('orders.emptyDesc')}
      </p>
      {hasFilters && (
        <Button variant="outline" onClick={onClear} className="mt-4 h-9 gap-1.5 rounded-xl text-[13px]">
          <X className="h-4 w-4" />
          {t('orders.clearFilters')}
        </Button>
      )}
    </div>
  );
}

function OrderListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/50 bg-white p-4 dark:border-border/40 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
