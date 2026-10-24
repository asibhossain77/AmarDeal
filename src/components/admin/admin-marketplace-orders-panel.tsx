'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShoppingBag, Loader2, CheckCircle2, XCircle, Search, ShieldCheck,
  Eye, PackageSearch, Inbox, Store, RotateCcw, X,
} from 'lucide-react';
import {
  OrderStatusBadge, PaymentStatusBadge, OrderProductThumb, CounterpartyAvatar,
  formatTaka, formatOrderDate, type OrderLite, type OrderCounts,
} from '@/components/shared/order-utils';
import { OrderDetailsDialog, OrderDetailData, OrderDialogAction, OrderDialogExtra } from '@/components/shared/order-details-dialog';

/* ═══════════════════════════════════════════════════════════════
   Admin Marketplace Orders — the platform administrator's
   order-management view.

   - Lists ALL marketplace orders (server: requireAdmin)
   - ?platformOwned=1 isolates platform-owned digital/SMM service
     orders (products sold by admin accounts) — regular sellers
     never see those (seller API is strictly sellerId=me)
   - Admin-only actions: VERIFY PAYMENT (the existing verification
     mechanism — the only path that makes an order "paid"),
     Complete, Cancel (unpaid), Refund (paid)
   ═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 20;

interface ListResponse {
  orders: OrderLite[];
  counts: OrderCounts;
  total: number;
  hasMore: boolean;
}

export function AdminMarketplaceOrdersPanel() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState('all');
  const [platformOwned, setPlatformOwned] = useState<'all' | '1' | '0'>('all');
  const [search, setSearch] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<OrderDetailData | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setSearchQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ status, sort, page: String(page), pageSize: String(PAGE_SIZE) });
    if (platformOwned !== 'all') p.set('platformOwned', platformOwned);
    if (searchQ) p.set('q', searchQ);
    return p;
  }, [status, sort, page, searchQ, platformOwned]);

  const { data, isLoading, isFetching } = useQuery<ListResponse>({
    queryKey: ['admin-marketplace-orders', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const orders = data?.orders ?? [];
  const counts = data?.counts;

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-marketplace-orders'] });

  /* Actions reuse the EXISTING admin endpoint — one guarded mutation API
     for every marketplace order type (verify/reject/set_status/note).
     Phase 5: the delivery-flow actions (ship / out_for_delivery /
     mark_delivered / deliver_digital / confirm_receipt) belong to the
     product-order workflow, so they route to the product-order status
     endpoint; courier-record corrections go to the shipping endpoint. */
  const PRODUCT_FLOW_ACTIONS = new Set<OrderDialogAction>(['ship', 'out_for_delivery', 'mark_delivered', 'deliver_digital', 'confirm_receipt', 'start', 'complete', 'dispute']);
  const handleAction = async (action: OrderDialogAction, reason?: string, extra?: OrderDialogExtra) => {
    if (!detail || action === 'pay_now') return;
    if (action === 'ship_edit') {
      setActionBusy(true);
      try {
        const res = await fetch(`/api/orders/${detail.id}/shipping`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...extra }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          toast.success(t('orders.actionDone'));
          setDetail({ ...detail, ...json.order, viewerRole: detail.viewerRole } as OrderDetailData);
          refresh();
        } else {
          toast.error(json.error || t('orders.actionFailed'));
        }
      } catch {
        toast.error(t('orders.actionFailed'));
      } finally {
        setActionBusy(false);
      }
      return;
    }
    if (PRODUCT_FLOW_ACTIONS.has(action) && detail.product) {
      setActionBusy(true);
      try {
        const res = await fetch(`/api/orders/${detail.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason, ...extra }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          toast.success(t('orders.actionDone'));
          setDetail({ ...detail, ...json.order, viewerRole: detail.viewerRole } as OrderDetailData);
          refresh();
        } else {
          toast.error(json.error || t('orders.actionFailed'));
        }
      } catch {
        toast.error(t('orders.actionFailed'));
      } finally {
        setActionBusy(false);
      }
      return;
    }
    const payload =
      action === 'verify_payment'
        ? { action: 'verify_payment' }
        : action === 'cancel'
          ? { action: 'set_status', status: 'cancelled', note: reason }
          : action === 'refund'
            ? { action: 'set_status', status: 'refunded', note: reason }
            : action === 'start'
              ? { action: 'set_status', status: 'processing' }
            : action === 'resolve_cancel'
              ? { action: 'set_status', status: 'cancelled', note: reason }
            : action === 'resolve_complete'
              ? { action: 'set_status', status: 'completed' }
              : { action: 'set_status', status: 'completed' };
    setActionBusy(true);
    try {
      const res = await fetch(`/api/admin/marketplace/orders/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t('orders.actionDone'));
        openDetailsRefresh(detail.id);
        refresh();
      } else {
        toast.error(json.error || t('orders.actionFailed'));
      }
    } catch {
      toast.error(t('orders.actionFailed'));
    } finally {
      setActionBusy(false);
    }
  };

  /** Re-pull the detail after a mutation so the dialog shows real state */
  const openDetailsRefresh = async (id: string) => {
    try {
      const res = await fetch(`/api/marketplace/orders/${id}`);
      const json = await res.json();
      if (res.ok && json.order) setDetail(json.order as OrderDetailData);
    } catch { /* keep current detail */ }
  };

  const pendingVerifyCount = counts?.pending ?? 0;
  const summaryCards = counts ? [
    { key: 'total', label: t('orders.cardTotal'), value: counts.total, icon: ShoppingBag, color: 'text-primary', bg: 'bg-primary/10', status: 'all' },
    { key: 'pending', label: t('orders.cardPending'), value: counts.pending, icon: ShieldCheck, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10', status: 'open' },
    { key: 'processing', label: t('orders.cardProcessing'), value: counts.processing, icon: Loader2, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10', status: 'processing' },
    { key: 'completed', label: t('orders.cardCompleted'), value: counts.completed, icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10', status: 'completed' },
    { key: 'refunded', label: t('orders.cardRefunded'), value: counts.refunded, icon: RotateCcw, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/10', status: 'refunded' },
  ] : [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t('orders.adminTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('orders.adminSubtitle')}</p>
        </div>
        <Select value={platformOwned} onValueChange={(v) => { setPlatformOwned(v as 'all' | '1' | '0'); setPage(1); }}>
          <SelectTrigger className="h-10 w-56 rounded-xl" aria-label={t('orders.scopeFilter')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('orders.scopeAll')}</SelectItem>
            <SelectItem value="1">{t('orders.scopePlatform')}</SelectItem>
            <SelectItem value="0">{t('orders.scopeSellers')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const active = status === card.status;
          return (
            <button
              key={card.key}
              onClick={() => { setStatus(active && card.status !== 'all' ? 'all' : card.status); setPage(1); }}
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
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('orders.adminSearchPlaceholder')}
            className="h-10 rounded-xl pl-9 pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label={t('orders.clearFilters')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-44 rounded-xl" aria-label={t('orders.filterStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['all', 'open', 'pending_payment', 'queued', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'refunded'].map((s) => (
              <SelectItem key={s} value={s}>{t(statusLabelKey(s) as never)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pendingVerifyCount > 0 && (
          <Badge variant="secondary" className="gap-1 border-0 bg-amber-100 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <ShieldCheck className="h-3 w-3" />
            {t('orders.verifyQueue', { count: pendingVerifyCount })}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {data && <span>{data.total.toLocaleString('en')} {t('orders.countSuffix')}</span>}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-white p-4 dark:border-border/40 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-44 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
            {status !== 'all' || searchQ || platformOwned !== 'all' ? <PackageSearch className="h-7 w-7 text-muted-foreground/50" /> : <Inbox className="h-7 w-7 text-muted-foreground/50" />}
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {status !== 'all' || searchQ || platformOwned !== 'all' ? t('orders.emptyFilteredTitle') : t('orders.emptyAdminTitle')}
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
            {status !== 'all' || searchQ || platformOwned !== 'all' ? t('orders.emptyFilteredDesc') : t('orders.emptyAdminDesc')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm dark:border-border/40 dark:bg-zinc-900 lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {[t('orders.colOrder'), t('orders.colProduct'), t('orders.colBuyer'), t('orders.colSeller'), t('orders.colTotal'), t('orders.colDate'), t('orders.colPayment'), t('orders.colStatus'), t('orders.colActions')].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${i === 4 ? 'text-right' : i === 8 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[12px] font-semibold text-foreground whitespace-nowrap">{o.orderNumber}</span>
                          {o.isPlatformOwned && (
                            <Badge variant="secondary" className="border-0 bg-primary/10 px-1.5 py-0 text-[9px] font-bold text-primary">
                              <Store className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <OrderProductThumb image={o.product.image} title={o.product.title} size="sm" />
                          <p className="truncate text-[13px] font-medium text-foreground">{o.product.title}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CounterpartyAvatar name={o.buyer?.name} imageLink={o.buyer?.imageLink} size={24} />
                          <span className="max-w-[110px] truncate text-[12px] text-foreground">{o.buyer?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="max-w-[110px] truncate text-[12px] text-muted-foreground">{o.seller?.name || '—'}</span>
                      </td>
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

          {/* Mobile cards */}
          <div className="space-y-2.5 lg:hidden">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border/50 bg-white p-3.5 shadow-sm dark:border-border/40 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="font-mono text-[12px] font-bold text-foreground">{o.orderNumber}</span>
                    {o.isPlatformOwned && (
                      <Badge variant="secondary" className="border-0 bg-primary/10 px-1.5 py-0 text-[9px] font-bold text-primary">{t('orders.platformChip')}</Badge>
                    )}
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <OrderProductThumb image={o.product.image} title={o.product.title} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-semibold text-foreground">{o.product.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {o.buyer?.name} → {o.seller?.name}
                    </p>
                  </div>
                </div>
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

      <OrderDetailsDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        order={detail}
        busy={actionBusy || detailBusy}
        onAction={handleAction}
        onRefresh={() => { if (detail) openDetailsRefresh(detail.id); refresh(); }}
      />
    </div>
  );
}

function statusLabelKey(s: string): string {
  if (s === 'all') return 'orders.filterAll';
  if (s === 'open') return 'orders.cardPending';
  return `orderStatus.${s}`;
}
