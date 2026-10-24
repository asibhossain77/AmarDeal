'use client';

/* ═══════════════════════════════════════════════════════════════
   Phase 7 — Seller Analytics & Earnings panel.

   Shows the seller's own numbers ONLY (the server hard-scopes every
   query to the session user):
   - Date-range filter (7d / 30d / 12w / 12m / custom)
   - Order KPI cards (total / completed / pending / cancelled / disputed)
   - Money KPIs (gross sales / refunds / commission / net + deal
     earnings kept separate)
   - Balance summary (available / pending / paid) → withdraw panel
   - Sales trend chart + best-selling products (shadcn ChartContainer)
   - Recent orders + pending actions
   - Itemized financial ledger with transaction references
   ═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShoppingBag, CheckCircle2, Clock3, XCircle, AlertTriangle, RotateCcw,
  TrendingUp, Banknote, Wallet, Receipt, Handshake, SlidersHorizontal,
  ChevronLeft, ChevronRight, ArrowRight, IndianRupee,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { OrderStatusBadge, PaymentStatusBadge, formatOrderDate } from '@/components/shared/order-utils';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';

const GLASS = 'relative rounded-2xl border !border-white/60 !bg-white/40 p-3.5 sm:p-5 shadow-xl !backdrop-blur-xl dark:!border-border dark:!bg-card/50 dark:!backdrop-blur-xl';

type Preset = '7d' | '30d' | '12w' | '12m' | 'custom';

/* ── API shapes ───────────────────────────────────────────────── */
interface AnalyticsResponse {
  range: { preset: Preset; from: string; to: string; unit: 'day' | 'week' | 'month' };
  orders: { total: number; completed: number; pending: number; cancelled: number; refunded: number; disputed: number };
  money: {
    grossSales: number; refunds: number; commission: number;
    marketplaceNet: number; dealEarnings: number; adjustments: number; totalNet: number;
  };
  balance: {
    available: number; pendingWithdrawals: number; withdrawnPaid: number;
    marketplaceGross: number; marketplaceRefunds: number; marketplaceCommission: number;
    marketplaceNet: number; adjustments: number; totalNetEarnings: number; totalEarnings: number;
  };
  series: { start: string; end: string; gross: number; refunds: number; commission: number; dealEarnings: number; adjustments: number; net: number; orders: number }[];
  products: { productId: string; title: string; orders: number; units: number; gross: number }[];
  recentOrders: { id: string; orderNumber: string; title: string; amount: number; status: string; paymentStatus: string; createdAt: string }[];
  pendingActions: {
    toStart: number; toFulfil: number; openDisputes: number; pendingCancellations: number;
    items: { id: string; orderNumber: string; title: string; status: string; action: string }[];
  };
}

interface LedgerItem {
  id: string; sourceType: string; sourceId: string; reference: string; type: string;
  amount: number; description: string; details: Record<string, unknown> | null; createdAt: string;
}
interface LedgerResponse { items: LedgerItem[]; page: number; pageSize: number; total: number; totalPages: number }

interface WithdrawalRow {
  id: string; amount: number; accountType: string; accountName: string;
  accountNumber: string; status: string; paymentReference: string | null;
  adminNote: string | null; createdAt: string;
}

const LEDGER_TYPE_STYLE: Record<string, { cls: string; key: string }> = {
  sale: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', key: 'p7.typeSale' },
  commission: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', key: 'p7.typeCommission' },
  refund: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400', key: 'p7.typeRefund' },
  commission_reversal: { cls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400', key: 'p7.typeCommissionReversal' },
  deal_earning: { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400', key: 'p7.typeDealEarning' },
  payout: { cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400', key: 'p7.typePayout' },
  adjustment: { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', key: 'p7.typeAdjustment' },
};

const WD_STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', label: 'পেন্ডিং' },
  approved: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400', label: 'অনুমোদিত' },
  completed: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'সম্পন্ন' },
  rejected: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400', label: 'প্রত্যাখ্যাত' },
};

function fmtTaka(n: number): string {
  return '৳' + Math.round(n).toLocaleString('en');
}
function fmtSigned(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + '৳' + Math.abs(Math.round(n)).toLocaleString('en');
}
function fmtDateTime(iso: string, locale: 'bn' | 'en'): string {
  return new Date(iso).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ═══════════════════════════════════════════════════════════════ */

export function SellerAnalyticsPanel() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const setDashboardPanel = useAppStore((s) => s.setDashboardPanel);

  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [ledgerType, setLedgerType] = useState('all');
  const [ledgerPage, setLedgerPage] = useState(1);

  const rangeQuery = useMemo(() => {
    if (preset === 'custom' && appliedCustom) {
      return `range=custom&from=${encodeURIComponent(appliedCustom.from)}&to=${encodeURIComponent(appliedCustom.to)}`;
    }
    if (preset === 'custom') return 'range=30d';
    return `range=${preset}`;
  }, [preset, appliedCustom]);

  const { data, isLoading, isError } = useQuery<AnalyticsResponse>({
    queryKey: ['seller-analytics', rangeQuery],
    queryFn: async () => {
      const r = await fetch(`/api/seller/analytics?${rangeQuery}`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    staleTime: 30_000,
  });

  const { data: ledger } = useQuery<LedgerResponse>({
    queryKey: ['seller-ledger', ledgerType, ledgerPage],
    queryFn: async () => {
      const p = ledgerType === 'all' ? '' : `&type=${ledgerType}`;
      const r = await fetch(`/api/seller/ledger?page=${ledgerPage}${p}`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    staleTime: 15_000,
  });

  const { data: wd } = useQuery<{ balance: AnalyticsResponse['balance']; withdrawals: WithdrawalRow[] }>({
    queryKey: ['seller-withdrawals'],
    queryFn: async () => {
      const r = await fetch('/api/user/seller-withdrawals');
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    staleTime: 30_000,
  });

  const chartConfig = {
    gross: { label: t('p7.legendGross'), color: '#65A30D' },
    refunds: { label: t('p7.legendRefunds'), color: '#DC2626' },
    net: { label: t('p7.legendNet'), color: '#0F766E' },
    orders: { label: t('p7.legendOrders'), color: '#D97706' },
  } satisfies ChartConfig;

  const series = useMemo(() => {
    if (!data) return [];
    return data.series.map((b) => {
      const d = new Date(b.start);
      const label =
        data.range.unit === 'month'
          ? d.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', year: '2-digit' })
          : d.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short' });
      return { label, gross: b.gross, refunds: b.refunds, net: b.net, orders: b.orders };
    });
  }, [data, locale]);

  const orderCards = data ? [
    { label: t('p7.ordersTotal'), value: data.orders.total, icon: ShoppingBag, cls: 'text-primary bg-primary/10' },
    { label: t('p7.ordersCompleted'), value: data.orders.completed, icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-500/10' },
    { label: t('p7.ordersPending'), value: data.orders.pending, icon: Clock3, cls: 'text-amber-600 bg-amber-500/10' },
    { label: t('p7.ordersCancelled'), value: data.orders.cancelled, icon: XCircle, cls: 'text-zinc-500 bg-zinc-500/10' },
    { label: t('p7.ordersDisputed'), value: data.orders.disputed, icon: AlertTriangle, cls: 'text-red-600 bg-red-500/10' },
  ] : [];

  const moneyCards = data ? [
    { label: t('p7.grossSales'), value: fmtTaka(data.money.grossSales), icon: IndianRupee, cls: 'text-emerald-600 bg-emerald-500/10' },
    { label: t('p7.refunds'), value: '−' + fmtTaka(data.money.refunds).slice(1), icon: RotateCcw, cls: 'text-red-600 bg-red-500/10' },
    { label: t('p7.commission'), value: '−' + fmtTaka(data.money.commission).slice(1), icon: Receipt, cls: 'text-amber-600 bg-amber-500/10' },
    { label: t('p7.marketplaceNet'), value: fmtTaka(data.money.marketplaceNet), icon: TrendingUp, cls: 'text-primary bg-primary/10' },
    { label: t('p7.dealEarnings'), value: fmtTaka(data.money.dealEarnings), icon: Handshake, cls: 'text-violet-600 bg-violet-500/10' },
    { label: t('p7.totalNet'), value: fmtTaka(data.money.totalNet), icon: Wallet, cls: 'text-teal-700 bg-teal-500/10' },
  ] : [];

  const applyCustom = () => {
    if (customFrom && customTo) {
      setAppliedCustom({ from: customFrom, to: customTo });
      setPreset('custom');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + range filter */}
      <div className={GLASS}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{t('p7.title')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('p7.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['7d', '30d', '12w', '12m'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPreset(p); setLedgerPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  preset === p
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {t(`p7.range${p}`)}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                preset === 'custom'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {t('p7.rangeCustom')}
            </button>
          </div>
        </div>
        {preset === 'custom' && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border/40 pt-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('p7.from')}</label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('p7.to')}</label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-40" />
            </div>
            <Button size="sm" className="h-9" onClick={applyCustom}>{t('p7.apply')}</Button>
          </div>
        )}
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {t('p7.noData')}
        </div>
      )}

      {/* Order KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {isLoading || orderCards.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={GLASS}>
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-6 w-10 animate-pulse rounded bg-muted" />
              </div>
            ))
          : orderCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
              <div className={GLASS}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{card.value.toLocaleString('en')}</p>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.cls}`}>
                    <card.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
      </div>

      {/* Money cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        {isLoading || moneyCards.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={GLASS}>
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-5 w-14 animate-pulse rounded bg-muted" />
              </div>
            ))
          : moneyCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
              <div className={GLASS}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-lg font-bold text-foreground sm:text-xl">{card.value}</p>
                  </div>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.cls}`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
      </div>
      <p className="-mt-2 px-1 text-xs text-muted-foreground">{t('p7.moneyNote')}</p>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={`${GLASS} xl:col-span-2`}>
          <h3 className="text-base font-semibold text-foreground">{t('p7.salesTrend')}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{t('p7.salesTrendDesc')}</p>
          <ChartContainer config={chartConfig} className="h-60 w-full sm:h-72">
            <ComposedChart data={series} accessibilityLayer margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="gross" fill="var(--color-gross)" radius={4} />
              <Bar dataKey="refunds" fill="var(--color-refunds)" radius={4} />
              <Line dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </div>

        <div className={GLASS}>
          <h3 className="text-base font-semibold text-foreground">{t('p7.bestSellers')}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{t('p7.bestSellersDesc')}</p>
          {data && data.products.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-60 w-full sm:h-72">
              <BarChart data={data.products.map((p) => ({ name: p.title.length > 14 ? p.title.slice(0, 14) + '…' : p.title, gross: p.gross }))} layout="vertical" accessibilityLayer margin={{ left: 8, right: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={104} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="gross" fill="var(--color-gross)" radius={4} barSize={16} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-60 items-center justify-center text-sm text-muted-foreground sm:h-72">{t('p7.noData')}</div>
          )}
        </div>
      </div>

      {/* Balance + pending actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={GLASS}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t('p7.payoutManage')}</h3>
            <Button size="sm" onClick={() => setDashboardPanel('seller-withdraw')} className="gap-1.5">
              <Banknote className="h-4 w-4" />{t('p7.withdrawBtn')}
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { label: t('p7.availableBalance'), value: wd?.balance.available ?? data?.balance.available ?? 0, cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: t('p7.pendingBalance'), value: wd?.balance.pendingWithdrawals ?? data?.balance.pendingWithdrawals ?? 0, cls: 'text-amber-600 dark:text-amber-400' },
              { label: t('p7.paidBalance'), value: wd?.balance.withdrawnPaid ?? data?.balance.withdrawnPaid ?? 0, cls: 'text-foreground' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`text-base font-bold ${row.cls}`}>{fmtTaka(row.value)}</span>
              </div>
            ))}
          </div>
          {/* Payout history */}
          <div className="mt-4 border-t border-border/40 pt-3">
            <h4 className="mb-2 text-sm font-semibold text-foreground">{t('p7.payoutHistory')}</h4>
            {wd && wd.withdrawals.length > 0 ? (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {wd.withdrawals.slice(0, 8).map((w) => {
                  const st = WD_STATUS_STYLE[w.status] ?? { cls: 'bg-muted text-muted-foreground', label: w.status };
                  return (
                    <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{fmtTaka(w.amount)} · {w.accountType}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {w.paymentReference ? `Ref: ${w.paymentReference} · ` : ''}{formatOrderDate(w.createdAt, locale)}
                        </p>
                      </div>
                      <Badge className={`${st.cls} border-0 text-[11px]`}>{st.label}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-muted-foreground">{t('p7.noPayouts')}</p>
            )}
          </div>
        </div>

        <div className={GLASS}>
          <h3 className="text-base font-semibold text-foreground">{t('p7.pendingActions')}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {data && ([
              { label: t('p7.toStart'), value: data.pendingActions.toStart, cls: 'text-amber-600 bg-amber-500/10' },
              { label: t('p7.toFulfil'), value: data.pendingActions.toFulfil, cls: 'text-orange-600 bg-orange-500/10' },
              { label: t('p7.openDisputes'), value: data.pendingActions.openDisputes, cls: 'text-red-600 bg-red-500/10' },
              { label: t('p7.pendingCancellations'), value: data.pendingActions.pendingCancellations, cls: 'text-zinc-600 bg-zinc-500/10' },
            ]).map((row) => (
              <div key={row.label} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className={`mt-0.5 text-xl font-bold ${row.cls.split(' ')[0]}`}>{row.value}</p>
              </div>
            ))}
          </div>
          {data && data.pendingActions.items.length > 0 && (
            <div className="mt-3 space-y-2">
              {data.pendingActions.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setDashboardPanel('seller-marketplace-orders')}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2 text-left transition-colors hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.orderNumber}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                    {item.action === 'start' ? t('p7.actionStart') : item.action === 'fulfil' ? t('p7.actionFulfil') : t('p7.actionDispute')}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders + product table */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={GLASS}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t('p7.recentOrders')}</h3>
            <Button size="sm" variant="ghost" onClick={() => setDashboardPanel('seller-marketplace-orders')} className="gap-1 text-xs">
              {t('p7.viewAllOrders')} <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {data && data.recentOrders.length > 0 ? data.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{o.title}</p>
                  <p className="text-xs text-muted-foreground">{o.orderNumber} · {formatOrderDate(o.createdAt, locale)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground">{fmtTaka(o.amount)}</span>
                  <OrderStatusBadge status={o.status} />
                </div>
              </div>
            )) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('p7.noData')}</p>
            )}
          </div>
        </div>

        <div className={GLASS}>
          <h3 className="text-base font-semibold text-foreground">{t('p7.bestSellers')}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-semibold">{t('p7.product')}</th>
                  <th className="py-2 pr-2 text-center font-semibold">{t('p7.orders')}</th>
                  <th className="py-2 pr-2 text-center font-semibold">{t('p7.units')}</th>
                  <th className="py-2 text-right font-semibold">{t('p7.gross')}</th>
                </tr>
              </thead>
              <tbody>
                {data && data.products.length > 0 ? data.products.map((p) => (
                  <tr key={p.productId} className="border-b border-border/30 last:border-0">
                    <td className="max-w-40 truncate py-2.5 pr-2 font-medium text-foreground">{p.title}</td>
                    <td className="py-2.5 pr-2 text-center text-muted-foreground">{p.orders}</td>
                    <td className="py-2.5 pr-2 text-center text-muted-foreground">{p.units}</td>
                    <td className="py-2.5 text-right font-bold text-foreground">{fmtTaka(p.gross)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">{t('p7.noData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className={GLASS}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t('p7.ledger')}</h3>
            <p className="text-xs text-muted-foreground">{t('p7.ledgerDesc')}</p>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', 'sale', 'refund', 'commission', 'deal_earning', 'payout', 'adjustment'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => { setLedgerType(tp); setLedgerPage(1); }}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  ledgerType === tp ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {tp === 'all' ? t('p7.ledgerAll') : t((LEDGER_TYPE_STYLE[tp]?.key ?? 'p7.ledgerAll') as never)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-border/50 bg-muted/20 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-semibold">{t('p7.ledgerDate')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('p7.ledgerDescription')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('p7.ledgerRef')}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t('p7.ledgerAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {ledger && ledger.items.length > 0 ? ledger.items.map((e) => {
                const style = LEDGER_TYPE_STYLE[e.type] ?? { cls: 'bg-muted text-muted-foreground', key: '' };
                return (
                  <tr key={e.id} className="border-b border-border/30 transition-colors hover:bg-accent/20 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{fmtDateTime(e.createdAt, locale)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Badge className={`${style.cls} shrink-0 border-0 text-[10px] font-semibold`}>{style.key ? t(style.key as never) : e.type}</Badge>
                        <span className="min-w-0 truncate text-foreground">{e.description}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {e.sourceType === 'marketplace_order' ? t('p7.sourceMarketplace') : e.sourceType === 'deal' ? t('p7.sourceDeal') : e.sourceType === 'withdrawal' ? t('p7.sourceWithdrawal') : t('p7.sourceAdjustment')} · {e.reference.slice(0, 18)}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-bold ${e.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : e.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {fmtSigned(e.amount)}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">{t('p7.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {ledger && ledger.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <Button size="sm" variant="outline" disabled={ledgerPage <= 1} onClick={() => setLedgerPage((p) => p - 1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" />{t('p7.prevPage')}
            </Button>
            <span className="text-xs text-muted-foreground">{ledger.page} / {ledger.totalPages}</span>
            <Button size="sm" variant="outline" disabled={ledgerPage >= ledger.totalPages} onClick={() => setLedgerPage((p) => p + 1)} className="gap-1">
              {t('p7.nextPage')}<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
