'use client';

/* ═══════════════════════════════════════════════════════════════
   Phase 7 — Admin: Seller Financial Reports.

   - Seller list with window-scoped aggregates (marketplace net vs
     deal earnings kept separate) + date-range filter
   - Per-seller detail: money breakdown, order counts, recent ledger
     (transaction references + timestamps), withdrawal history
   - Manual financial adjustment (±, reason REQUIRED) — written to
     the ledger + audit log; the seller is notified
   All figures computed server-side from authoritative records.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, RotateCcw, Receipt, Handshake, SlidersHorizontal,
  ChevronLeft, Search, ArrowLeft, IndianRupee, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n';
import { formatOrderDate } from '@/components/shared/order-utils';

const MotionDiv = motion.div as any;

interface Money {
  grossSales: number; refunds: number; commission: number;
  dealEarnings: number; adjustments: number; payoutsPaid: number;
  marketplaceNet: number; totalNet: number;
}
interface SellerRow {
  id: string; name: string; businessName: string | null; phone: string;
  sellerDisabled: boolean; money: Money;
}
interface LedgerRow {
  id: string; sourceType: string; sourceId: string; reference: string; type: string;
  amount: number; description: string; createdAt: string;
}
interface DetailResponse {
  seller: SellerRow & { sellerDisabled: boolean; createdAt: string };
  money: Money;
  balance: {
    available: number; pendingWithdrawals: number; withdrawnPaid: number;
    legacyPayouts: number; adjustments: number; totalNetEarnings: number;
  };
  orderCounts: { status: string; count: number }[];
  ledger: LedgerRow[];
  withdrawals: { id: string; amount: number; accountType: string; status: string; paymentReference: string | null; createdAt: string }[];
}

function fmtTaka(n: number): string {
  return '৳' + Math.round(n).toLocaleString('en');
}
function fmtSigned(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + '৳' + Math.abs(Math.round(n)).toLocaleString('en');
}

const TYPE_BADGE: Record<string, { cls: string; key: string }> = {
  sale: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', key: 'p7.typeSale' },
  commission: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', key: 'p7.typeCommission' },
  refund: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400', key: 'p7.typeRefund' },
  commission_reversal: { cls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400', key: 'p7.typeCommissionReversal' },
  deal_earning: { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400', key: 'p7.typeDealEarning' },
  payout: { cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400', key: 'p7.typePayout' },
  adjustment: { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', key: 'p7.typeAdjustment' },
};

export function AdminSellerFinancialsPanel() {
  const t = useT();
  const qc = useQueryClient();
  const locale = 'bn' as const;

  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});
  const [search, setSearch] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);

  const windowQ = useMemoQ(applied);

  const { data: list, isLoading: listLoading } = useQuery<{ sellers: SellerRow[] }>({
    queryKey: ['admin-seller-financials-list', windowQ],
    queryFn: async () => {
      const r = await fetch(`/api/admin/seller-financials${windowQ}`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    enabled: !selected,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<DetailResponse>({
    queryKey: ['admin-seller-financials-detail', selected, windowQ],
    queryFn: async () => {
      const r = await fetch(`/api/admin/seller-financials?sellerId=${selected}${windowQ}`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    enabled: !!selected,
  });

  const submitAdjustment = async () => {
    if (!selected) return;
    const amt = Number(adjAmount);
    if (!Number.isFinite(amt) || Math.round(amt * 100) === 0) {
      toast.error(t('adminFin.adjustHint'));
      return;
    }
    if (adjReason.trim().length < 3) {
      toast.error(t('adminFin.adjustHint'));
      return;
    }
    setSavingAdj(true);
    try {
      const r = await fetch('/api/admin/seller-ledger/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: selected, amount: amt, reason: adjReason.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(t('adminFin.adjustSuccess'));
      setAdjAmount('');
      setAdjReason('');
      qc.invalidateQueries({ queryKey: ['admin-seller-financials-detail', selected] });
      qc.invalidateQueries({ queryKey: ['admin-seller-financials-list'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingAdj(false);
    }
  };

  const filtered = (list?.sellers ?? []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.businessName?.toLowerCase().includes(q);
  });

  const moneyCards = (m: Money) => [
    { label: t('p7.grossSales'), value: fmtTaka(m.grossSales), icon: IndianRupee, cls: 'text-emerald-600 bg-emerald-500/10' },
    { label: t('p7.refunds'), value: '−' + fmtTaka(m.refunds).slice(1), icon: RotateCcw, cls: 'text-red-600 bg-red-500/10' },
    { label: t('p7.commission'), value: '−' + fmtTaka(m.commission).slice(1), icon: Receipt, cls: 'text-amber-600 bg-amber-500/10' },
    { label: t('p7.marketplaceNet'), value: fmtTaka(m.marketplaceNet), icon: TrendingUp, cls: 'text-primary bg-primary/10' },
    { label: t('p7.dealEarnings'), value: fmtTaka(m.dealEarnings), icon: Handshake, cls: 'text-violet-600 bg-violet-500/10' },
    { label: t('p7.totalNet'), value: fmtTaka(m.totalNet), icon: Wallet, cls: 'text-teal-700 bg-teal-500/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Header + window filter */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
            <Users className="h-5 w-5 text-primary" />{t('adminFin.financialsTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('adminFin.financialsDesc')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('p7.from')}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('p7.to')}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
          </div>
          <Button size="sm" className="h-9" onClick={() => setApplied({ from: from || undefined, to: to || undefined })}>
            {t('p7.apply')}
          </Button>
          {(applied.from || applied.to) && (
            <Button size="sm" variant="ghost" className="h-9" onClick={() => { setFrom(''); setTo(''); setApplied({}); }}>
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* ── Detail view ── */}
      {selected && (
        <>
          <Button size="sm" variant="outline" onClick={() => setSelected(null)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />{t('adminFin.backToList')}
          </Button>

          {detailLoading || !detail ? (
            <div className="rounded-2xl border border-border/60 p-10 text-center text-sm text-muted-foreground">…</div>
          ) : (
            <>
              <MotionDiv initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-foreground">{detail.seller.businessName || detail.seller.name}</h2>
                      <p className="text-xs text-muted-foreground">{detail.seller.name} · {detail.seller.phone}</p>
                    </div>
                    {detail.seller.sellerDisabled && (
                      <Badge className="bg-red-100 text-red-700 border-0">{t('adminSellerWd.rejected')}</Badge>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
                    {moneyCards(detail.money).map((c) => (
                      <div key={c.label} className="rounded-xl border border-border/40 bg-muted/20 p-3">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-xs text-muted-foreground">{c.label}</p>
                          <c.icon className={`h-3.5 w-3.5 shrink-0 ${c.cls.split(' ')[0]}`} />
                        </div>
                        <p className="mt-1 text-base font-bold text-foreground">{c.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: t('p7.availableBalance'), value: detail.balance.available },
                      { label: t('p7.pendingBalance'), value: detail.balance.pendingWithdrawals },
                      { label: t('p7.paidBalance'), value: detail.balance.withdrawnPaid },
                      { label: t('p7.adjustments'), value: detail.balance.adjustments },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-bold text-foreground">{fmtTaka(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </MotionDiv>

              {/* Order counts + adjustment form */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">{t('adminFin.orderCounts')}</h3>
                  <div className="space-y-1.5">
                    {detail.orderCounts.length > 0 ? detail.orderCounts.map((c) => (
                      <div key={c.status} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{c.status}</span>
                        <span className="font-bold text-foreground">{c.count}</span>
                      </div>
                    )) : <p className="text-xs text-muted-foreground">{t('p7.noData')}</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/60 p-5 lg:col-span-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />{t('adminFin.makeAdjustment')}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t('adminFin.adjustHint')}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="number" step="0.01" placeholder={t('adminFin.adjustAmount')}
                      value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className="h-10 sm:w-44"
                    />
                    <Input
                      placeholder={t('adminFin.adjustReason')}
                      value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="h-10 flex-1"
                    />
                    <Button className="h-10" disabled={savingAdj} onClick={submitAdjustment}>
                      {savingAdj ? '…' : t('adminFin.adjustSubmit')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Ledger */}
              <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">{t('adminFin.recentLedger')}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-y border-border/50 bg-muted/20 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">{t('p7.ledgerDate')}</th>
                        <th className="px-3 py-2 font-semibold">{t('p7.ledgerDescription')}</th>
                        <th className="px-3 py-2 font-semibold">{t('p7.ledgerRef')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('p7.ledgerAmount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.ledger.length > 0 ? detail.ledger.map((e) => {
                        const style = TYPE_BADGE[e.type] ?? { cls: 'bg-muted text-muted-foreground', key: '' };
                        return (
                          <tr key={e.id} className="border-b border-border/30 last:border-0">
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatOrderDate(e.createdAt, locale)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Badge className={`${style.cls} shrink-0 border-0 text-[10px]`}>{style.key ? t(style.key as never) : e.type}</Badge>
                                <span className="min-w-0 truncate">{e.description}</span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{e.reference.slice(0, 18)}</td>
                            <td className={`whitespace-nowrap px-3 py-2 text-right font-bold ${e.amount > 0 ? 'text-emerald-600' : e.amount < 0 ? 'text-red-600' : ''}`}>{fmtSigned(e.amount)}</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">{t('p7.noData')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── List view ── */}
      {!selected && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t('adminFin.sellerList')}</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('adminFin.searchSeller')} className="h-9 w-full pl-8 sm:w-64" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y border-border/50 bg-muted/20 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-semibold">{t('adminFin.selectSeller')}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t('adminFin.marketplaceNetCol')}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t('adminFin.dealEarningsCol')}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t('adminFin.totalNetCol')}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t('p7.ledger')}</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">…</td></tr>
                ) : filtered.length > 0 ? filtered.map((s) => (
                  <tr key={s.id} className="cursor-pointer border-b border-border/30 transition-colors hover:bg-accent/20 last:border-0" onClick={() => setSelected(s.id)}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{s.businessName || s.name}{s.sellerDisabled ? ' ⚠' : ''}</p>
                      <p className="text-xs text-muted-foreground">{s.phone}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">{fmtTaka(s.money.marketplaceNet)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{fmtTaka(s.money.dealEarnings)}</td>
                    <td className="px-3 py-3 text-right font-bold text-foreground">{fmtTaka(s.money.totalNet)}</td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                        {t('adminFin.financialsTitle').split(' ')[0]} <ChevronLeft className="h-3 w-3 rotate-180" />
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('p7.noData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tiny helper — stable querystring from applied window. */
function useMemoQ(applied: { from?: string; to?: string }): string {
  const parts: string[] = [];
  if (applied.from) parts.push(`from=${encodeURIComponent(applied.from)}`);
  if (applied.to) parts.push(`to=${encodeURIComponent(applied.to)}`);
  return parts.length ? `&${parts.join('&')}` : '';
}
