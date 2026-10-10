'use client';

/**
 * Order Detail — Marketplace Direct Order with status timeline,
 * payment info and fulfilment info. Owner-scoped (server enforces).
 * Payment actions appear only for unpaid pending_payment orders.
 */

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package, Loader2, ArrowLeft, ShieldCheck, Clock, Link2, CreditCard,
  Wallet, Ban, CheckCircle2, Copy, XCircle, LayoutList, History, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { useT, type TranslationKey } from '@/lib/i18n';
import { OrderStatusBadge, formatMoney, formatDate, truncateLink } from './my-orders-panel';

const emptySubscribe = () => () => {};

interface OrderEvent {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  actorType: string;
  actorName: string | null;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  serviceName: string;
  linkUrl: string;
  linkType: string | null;
  quantity: number;
  unitPriceAtOrder: number;
  pricingUnit: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentMethodName: string | null;
  senderNumber: string | null;
  transactionId: string | null;
  paidAt: string | null;
  fulfilmentNote: string | null;
  startCount: number | null;
  remains: number | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  service: {
    deliveryEstimate: string | null;
    instructions: string | null;
  };
  events: OrderEvent[];
}

interface ManualMethod {
  id: string;
  name: string;
  accountNumber: string;
  instructions: string | null;
  color: string;
}

export function OrderDetailPanel() {
  const t = useT();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const user = useAppStore((s) => s.user);
  const orderDetailId = useAppStore((s) => s.orderDetailId);

  const [showPayBox, setShowPayBox] = useState(false);
  const [methods, setMethods] = useState<ManualMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [manualMethodId, setManualMethodId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [payingGateway, setPayingGateway] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = useCallback(async (): Promise<OrderDetail> => {
    const res = await fetch(`/api/marketplace/orders/${orderDetailId}`);
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'failed');
    return data.order;
  }, [orderDetailId]);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['mp-order', orderDetailId, user?.id],
    queryFn: fetchOrder,
    enabled: mounted && !!orderDetailId && !!user,
    refetchInterval: 10000,
  });

  // Gateway availability
  useEffect(() => {
    fetch('/api/auth/piprapay-status')
      .then((r) => r.json())
      .then((d) => setGatewayEnabled(!!d?.enabled))
      .catch(() => setGatewayEnabled(false));
  }, []);

  const canPay = order?.status === 'pending_payment' && order?.paymentStatus === 'unpaid';

  // Load manual methods when the pay box opens
  useEffect(() => {
    if (!showPayBox) return;
    setMethodsLoading(true);
    fetch('/api/payment-methods')
      .then((r) => r.json())
      .then((d) => {
        const list: ManualMethod[] = Array.isArray(d.methods)
          ? d.methods
          : Array.isArray(d)
            ? d
            : [];
        setMethods(list.filter((m) => !('status' in m) || m.status === 'active'));
      })
      .catch(() => {})
      .finally(() => setMethodsLoading(false));
  }, [showPayBox]);

  const handleGatewayPay = async () => {
    if (!order) return;
    setPayingGateway(true);
    try {
      const res = await fetch('/api/marketplace/payment/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (data.success && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast.error(data.error || t('orderDetail.payFailed'));
      }
    } catch {
      toast.error(t('orderDetail.payFailed'));
    } finally {
      setPayingGateway(false);
    }
  };

  const handleManualPay = async () => {
    if (!order || !manualMethodId || !senderNumber.trim() || !transactionId.trim()) {
      toast.error(t('orderDetail.fillAll'));
      return;
    }
    setSubmittingManual(true);
    try {
      const res = await fetch(`/api/marketplace/orders/${order.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: manualMethodId,
          senderNumber: senderNumber.trim(),
          transactionId: transactionId.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('orderDetail.manualSubmitted'));
        setShowPayBox(false);
        setSenderNumber('');
        setTransactionId('');
        refetch();
      } else {
        toast.error(data.error || t('orderDetail.payFailed'));
      }
    } catch {
      toast.error(t('orderDetail.payFailed'));
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/marketplace/orders/${order.id}/cancel`, { method: 'POST' });
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
      setCancelling(false);
    }
  };

  const backToList = () => {
    const store = useAppStore.getState();
    store.setDashboardPanel('my-orders');
  };

  const copyTxn = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => toast.success(t('orderDetail.copied')),
      () => {},
    );
  };

  if (!mounted) return null;

  if (!orderDetailId) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">{t('myOrders.empty')}</p>
        <Button variant="outline" onClick={backToList} className="mt-4 gap-2 rounded-xl text-[13px]">
          <ArrowLeft className="h-4 w-4" />{t('orderDetail.backToOrders')}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted/50" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted/50" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <XCircle className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm text-muted-foreground">{t('myOrders.loadError')}</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4 gap-2 rounded-xl text-[13px]">
          <Loader2 className="h-4 w-4" />{t('myOrders.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={backToList}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />{t('orderDetail.backToOrders')}
        </button>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-border/30 bg-card p-5 dark:border-border/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold text-foreground" dir="ltr">{order.orderNumber}</span>
              <OrderStatusBadge status={order.status} paymentStatus={order.paymentStatus} t={t} />
            </div>
            <h1 className="mt-1.5 flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
              <Zap className="h-5 w-5 shrink-0 text-primary" />
              {order.serviceName}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-primary">{formatMoney(order.totalAmount)}</p>
            <p className="text-[11px] text-muted-foreground" dir="ltr">{formatMoney(order.unitPriceAtOrder)} / 1,000 × {order.quantity.toLocaleString('en-BD')}</p>
          </div>
        </div>

        {/* Key facts */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/40 p-3 dark:bg-zinc-800/40">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Link2 className="h-3 w-3" />{t('orderDetail.targetLink')}</p>
            <a
              href={order.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block truncate text-[12px] font-medium text-primary hover:underline"
              dir="ltr"
              title={order.linkUrl}
            >
              {order.linkUrl}
            </a>
            {order.linkType && <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{order.linkType.replace(/_/g, ' ')}</span>}
          </div>
          <div className="rounded-xl bg-muted/40 p-3 dark:bg-zinc-800/40">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Clock className="h-3 w-3" />{t('orderDetail.placedAt')}</p>
            <p className="mt-1 text-[12px] font-medium text-foreground" dir="ltr">{formatDate(order.createdAt)}</p>
            {order.service?.deliveryEstimate && (
              <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">{t('orderDetail.estimate')}: {order.service.deliveryEstimate}</p>
            )}
          </div>
        </div>

        {/* Payment info */}
        <div className="mt-4 rounded-xl border border-border/30 p-3.5 dark:border-border/20">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <CreditCard className="h-3 w-3" />{t('orderDetail.paymentInfo')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            <span className="text-muted-foreground">{t('orderDetail.paymentStatus')}:
              <span className={`ml-1 font-bold ${order.paymentStatus === 'paid' ? 'text-primary' : order.paymentStatus === 'failed' ? 'text-destructive' : 'text-foreground'}`}>
                {t(`orderPayment.${order.paymentStatus}` as TranslationKey)}
              </span>
            </span>
            {order.paymentMethodName && <span className="text-muted-foreground">{order.paymentMethodName}</span>}
            {order.senderNumber && <span className="text-muted-foreground" dir="ltr">{order.senderNumber}</span>}
            {order.transactionId && (
              <span className="flex items-center gap-1 text-muted-foreground" dir="ltr">
                TXN: <span className="font-mono text-[11px] font-semibold text-foreground">{order.transactionId}</span>
                <button onClick={() => copyTxn(order.transactionId!)} aria-label="copy transaction id" className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </span>
            )}
            {order.paidAt && <span className="text-muted-foreground" dir="ltr">{t('orderDetail.paidAt')}: {formatDate(order.paidAt)}</span>}
          </div>

          {/* Payment actions — only while unpaid */}
          {canPay && !showPayBox && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setShowPayBox(true)} className="h-10 gap-2 rounded-xl px-4 text-[12px] font-semibold">
                <CreditCard className="h-3.5 w-3.5" />{t('myOrders.payNow')}
              </Button>
              <Button
                onClick={handleCancel}
                disabled={cancelling}
                variant="outline"
                className="h-10 gap-2 rounded-xl px-4 text-[12px] font-semibold text-muted-foreground hover:text-destructive"
              >
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                {t('myOrders.cancel')}
              </Button>
            </div>
          )}

          {/* Pay box */}
          {canPay && showPayBox && (
            <div className="mt-3 space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
              {gatewayEnabled && (
                <button
                  onClick={handleGatewayPay}
                  disabled={payingGateway}
                  className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-background p-3 text-left transition-colors hover:bg-accent disabled:opacity-60 dark:bg-zinc-900"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    {payingGateway ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Wallet className="h-4 w-4 text-primary" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-foreground">{t('orderDetail.gatewayPay')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('orderDetail.gatewayDesc')}</p>
                  </div>
                </button>
              )}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">{t('orderDetail.manualPay')}</p>
                {methodsLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t('myOrders.loading')}</div>
                ) : methods.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{t('orderDetail.noMethods')}</p>
                ) : (
                  <div className="mt-2 space-y-2.5">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {methods.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setManualMethodId(m.id)}
                          className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${manualMethodId === m.id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border/40 hover:border-primary/25 dark:border-border/25'}`}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: m.color || '#84CC16' }}>
                            {m.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-foreground">{m.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground" dir="ltr">{m.accountNumber}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} placeholder={t('orderDetail.senderNumber')} className="h-10 rounded-xl text-[12px]" dir="ltr" />
                      <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder={t('orderDetail.txnId')} className="h-10 rounded-xl text-[12px]" dir="ltr" />
                    </div>
                    <Button
                      onClick={handleManualPay}
                      disabled={submittingManual || !manualMethodId || !senderNumber.trim() || !transactionId.trim()}
                      variant="outline"
                      className="h-10 w-full gap-2 rounded-xl text-[12px] font-semibold"
                    >
                      {submittingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {t('orderDetail.submitPayment')}
                    </Button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowPayBox(false)} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
                {t('orderDetail.closePayBox')}
              </button>
            </div>
          )}
        </div>

        {/* Fulfilment info */}
        {(order.fulfilmentNote || order.startCount !== null || order.remains !== null) && (
          <div className="mt-4 rounded-xl border border-border/30 p-3.5 dark:border-border/20">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <LayoutList className="h-3 w-3" />{t('orderDetail.fulfilment')}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
              {order.startCount !== null && (
                <span className="text-muted-foreground">{t('orderDetail.startCount')}: <span className="font-semibold text-foreground tabular-nums">{order.startCount.toLocaleString('en-BD')}</span></span>
              )}
              {order.remains !== null && (
                <span className="text-muted-foreground">{t('orderDetail.remains')}: <span className="font-semibold text-foreground tabular-nums">{order.remains.toLocaleString('en-BD')}</span></span>
              )}
            </div>
            {order.fulfilmentNote && (
              <p className="mt-2 rounded-lg bg-muted/40 p-2.5 text-[12px] leading-relaxed text-muted-foreground whitespace-pre-wrap dark:bg-zinc-800/40">{order.fulfilmentNote}</p>
            )}
          </div>
        )}

        {/* Instructions */}
        {order.service?.instructions && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{order.service.instructions}</p>
          </div>
        )}
      </div>

      {/* Status timeline */}
      <div className="rounded-2xl border border-border/30 bg-card p-5 dark:border-border/20">
        <h2 className="flex items-center gap-2 text-[14px] font-bold text-foreground">
          <History className="h-4 w-4 text-primary" />{t('orderDetail.timeline')}
        </h2>
        {order.events.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">{t('orderDetail.noEvents')}</p>
        ) : (
          <ol className="mt-4 space-y-0">
            {order.events.map((e, i) => {
              const isLast = i === order.events.length - 1;
              return (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {/* connector */}
                  {!isLast && <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden="true" />}
                  <span className={`relative z-10 mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border-2 ${eventDotColor(e.type)}`}>
                    <span className="h-[5px] w-[5px] rounded-full bg-current" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-[12px] font-bold text-foreground">{t(`orderEvent.${e.type}` as TranslationKey)}</p>
                      <span className="text-[10px] text-muted-foreground" dir="ltr">{formatDate(e.createdAt)}</span>
                    </div>
                    {e.message && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground" dir="auto">{e.message}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function eventDotColor(type: string): string {
  switch (type) {
    case 'payment_verified':
    case 'status_changed':
      return 'border-primary text-primary bg-primary/10';
    case 'payment_failed':
      return 'border-destructive text-destructive bg-destructive/10';
    case 'cancelled':
      return 'border-zinc-400 text-zinc-500 bg-zinc-200/40 dark:bg-zinc-700/40';
    case 'payment_submitted':
      return 'border-amber-500 text-amber-600 bg-amber-500/10';
    default:
      return 'border-border text-muted-foreground bg-muted';
  }
}
