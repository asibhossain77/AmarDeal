'use client';

/**
 * My Orders — the customer's Marketplace Direct Orders list.
 * Server-scoped to the session user (no client userId is sent).
 */

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package, Clock, Loader2, ChevronRight, Ban, XCircle, CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useT, type TranslationKey } from '@/lib/i18n';
import { CUSTOMER_CANCELLABLE } from '@/lib/marketplace-pricing';

const emptySubscribe = () => () => {};

export interface MyOrderRow {
  id: string;
  orderNumber: string;
  serviceName: string;
  linkUrl: string;
  quantity: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export function formatMoney(amount: number): string {
  return '৳' + amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function truncateLink(link: string, max = 42): string {
  return link.length > max ? link.slice(0, max - 1) + '…' : link;
}

export function OrderStatusBadge({ status, paymentStatus, t }: { status: string; paymentStatus: string; t: ReturnType<typeof useT> }) {
  const map: Record<string, string> = {
    pending_payment: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    queued: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    processing: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
    in_progress: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
    completed: 'bg-primary/15 text-primary dark:bg-primary/20',
    partial: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
    cancelled: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    refunded: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400',
  };
  return (
    <Badge variant="secondary" className={`gap-1 border-0 text-[10px] font-bold ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {t(`orderStatus.${status}` as TranslationKey)}
      {status === 'pending_payment' && paymentStatus === 'awaiting_verification' && (
        <span className="opacity-70">· {t('orderPayment.awaiting_verification')}</span>
      )}
    </Badge>
  );
}

export function MyOrdersPanel() {
  const t = useT();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const user = useAppStore((s) => s.user);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchOrders = useCallback(async (): Promise<MyOrderRow[]> => {
    const res = await fetch('/api/marketplace/orders');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    return data.orders || [];
  }, []);

  const { data: orders, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['my-mp-orders', user?.id],
    queryFn: fetchOrders,
    enabled: mounted && !!user,
    refetchInterval: 15000,
  });

  const handleCancel = async (orderId: string) => {
    setCancelling(orderId);
    try {
      const res = await fetch(`/api/marketplace/orders/${orderId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(t('myOrders.cancelled'));
        refetch();
      } else {
        toast.error(data.error || t('myOrders.cancelFailed'));
      }
    } catch {
      toast.error(t('myOrders.cancelFailed'));
    } finally {
      setCancelling(null);
    }
  };

  const openOrder = (id: string) => {
    const store = useAppStore.getState();
    store.setOrderDetailId(id);
    store.setDashboardPanel('order-detail');
  };

  const openMarketplace = () => {
    useAppStore.getState().setView('page-marketplace');
  };

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
            <Package className="h-5 w-5 text-primary" />
            {t('myOrders.title')}
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{t('myOrders.subtitle')}</p>
        </div>
        <Button onClick={openMarketplace} variant="outline" size="sm" className="gap-1.5 rounded-xl text-[12px] font-semibold">
          <Package className="h-3.5 w-3.5" />{t('myOrders.newOrder')}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border/30 bg-card p-4">
              <div className="flex justify-between"><div className="h-4 w-28 rounded bg-muted" /><div className="h-5 w-20 rounded bg-muted" /></div>
              <div className="mt-3 h-3 w-2/3 rounded bg-muted" />
              <div className="mt-3 h-3 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 py-14 text-center">
          <XCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('myOrders.loadError')}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl gap-1.5 text-[12px]">
            <Loader2 className="h-3.5 w-3.5" />{t('myOrders.retry')}
          </Button>
        </div>
      ) : !orders || orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/50 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t('myOrders.empty')}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('myOrders.emptyDesc')}</p>
          </div>
          <Button onClick={openMarketplace} className="gap-2 rounded-xl text-[13px] font-semibold">
            <Package className="h-4 w-4" />{t('myOrders.browseServices')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3" role="list">
          {orders.map((order) => (
            <article
              key={order.id}
              role="listitem"
              className="group cursor-pointer rounded-2xl border border-border/30 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md dark:border-border/20"
              onClick={() => openOrder(order.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-bold text-foreground" dir="ltr">{order.orderNumber}</span>
                    <OrderStatusBadge status={order.status} paymentStatus={order.paymentStatus} t={t} />
                  </div>
                  <h3 className="mt-1 truncate text-[14px] font-semibold text-foreground">{order.serviceName}</h3>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground" dir="ltr" title={order.linkUrl}>
                    {truncateLink(order.linkUrl)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[15px] font-extrabold text-primary">{formatMoney(order.totalAmount)}</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    <span dir="ltr">{formatDate(order.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-3 dark:border-border/20">
                <span className="text-[11px] text-muted-foreground">
                  {t('myOrders.quantity')}: <span className="font-semibold text-foreground tabular-nums">{order.quantity.toLocaleString('en-BD')}</span>
                  {' · '}
                  {t(`orderPayment.${order.paymentStatus}` as TranslationKey)}
                </span>
                <div className="flex items-center gap-2">
                  {order.status === 'pending_payment' && order.paymentStatus === 'unpaid' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}
                      disabled={cancelling === order.id}
                      className="h-8 gap-1 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                    >
                      {cancelling === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                      {t('myOrders.cancel')}
                    </Button>
                  )}
                  {order.status === 'pending_payment' && order.paymentStatus === 'unpaid' && (
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openOrder(order.id); }}
                      className="h-8 gap-1 rounded-lg px-2.5 text-[11px] font-semibold"
                    >
                      <CreditCard className="h-3 w-3" />{t('myOrders.payNow')}
                    </Button>
                  )}
                  <span className="flex items-center gap-0.5 text-[11px] font-semibold text-primary">
                    {t('myOrders.details')}<ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </article>
          ))}
          {dataUpdatedAt > 0 && (
            <p className="text-center text-[10px] text-muted-foreground/60">
              {t('myOrders.autoRefresh')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
