'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Copy,
  Check,
  Wallet,
  CreditCard,
  Building2,
  Receipt,
  ArrowUpDown,
  Banknote,
  HourglassIcon,
  Ban,
  ShieldAlert,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

/* ─── Types ─── */
interface PaymentMethodInfo {
  id: string;
  name: string;
  accountNumber: string;
  accountType: string;
  color: string;
  image: string | null;
}

interface DealRow {
  id: string;
  title: string;
  amount: number;
  status: string;
  paymentAmount: number | null;
  senderNumber: string | null;
  transactionId: string | null;
  platformFee: number | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  buyerId: string;
  sellerId: string | null;
  creatorId: string;
  paymentMethod: PaymentMethodInfo | null;
  buyer: { id: string; name: string };
  seller: { id: string; name: string } | null;
}

type PaymentStatus = 'paid' | 'unpaid' | 'verifying' | 'wrong_info' | 'cancelled';

/* ─── Helpers ─── */
const emptySubscribe = () => () => {};

function getPaymentStatus(deal: DealRow): PaymentStatus {
  if (deal.rejectionReason === 'wrong_info') return 'wrong_info';
  if (deal.status === 'cancelled' || deal.status === 'rejected') return 'cancelled';
  if (!deal.paymentAmount || deal.status === 'created' || deal.status === 'pending') return 'unpaid';
  if (deal.status === 'payment_pending') return 'verifying';
  return 'paid';
}

function getPaymentStatusLabel(status: PaymentStatus, t: (key: any) => string): string {
  switch (status) {
    case 'paid': return t('status.paid');
    case 'unpaid': return t('status.unpaid');
    case 'verifying': return t('status.verifying');
    case 'wrong_info': return t('status.wrongInfo');
    case 'cancelled': return t('status.cancelled');
  }
}

function getPaymentStatusBadge(status: PaymentStatus, t: (key: any) => string) {
  const label = getPaymentStatusLabel(status, t);
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium gap-1"><CheckCircle2 className="h-3 w-3" />{label}</Badge>;
    case 'unpaid':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium gap-1"><XCircle className="h-3 w-3" />{label}</Badge>;
    case 'verifying':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium gap-1"><Clock className="h-3 w-3" />{label}</Badge>;
    case 'wrong_info':
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0 font-medium gap-1"><AlertCircle className="h-3 w-3" />{label}</Badge>;
    case 'cancelled':
      return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0 font-medium gap-1"><Ban className="h-3 w-3" />{label}</Badge>;
  }
}

function getMethodIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('bkash')) return Wallet;
  if (lower.includes('nagad')) return CreditCard;
  if (lower.includes('rocket')) return Wallet;
  if (lower.includes('bank')) return Building2;
  return Wallet;
}

function formatTaka(amount: number): string {
  return '৳' + Math.round(amount).toLocaleString('en');
}

/* ═══════════════════════════════════════════
   Glass Card
   ═══════════════════════════════════════════ */

function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border !border-white/60 !bg-white/40 p-3.5 sm:p-5 shadow-xl !backdrop-blur-xl dark:!border-zinc-800/50 dark:!bg-zinc-900/50 dark:!backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Copy Button ─── */
function CopyBtn({ text, t }: { text: string; t: (key: any) => string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleCopy(); }}
      className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
      title={t('deals.copy')}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ═══════════════════════════════════════════
   Stat Cards
   ═══════════════════════════════════════════ */

function StatCards({ deals, t }: { deals: DealRow[]; t: (key: any) => string }) {
  const totalDeals = deals.length;
  const paid = deals.filter((d) => getPaymentStatus(d) === 'paid').length;
  const unpaid = deals.filter((d) => getPaymentStatus(d) === 'unpaid').length;
  const verifying = deals.filter((d) => getPaymentStatus(d) === 'verifying').length;

  const items = [
    { label: t('payment.totalTxn'), value: totalDeals.toLocaleString('en'), icon: Receipt, color: 'text-primary', bg: 'bg-primary/10' },
    { label: t('status.paid'), value: paid.toLocaleString('en'), icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('status.unpaid'), value: unpaid.toLocaleString('en'), icon: XCircle, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10' },
    { label: t('status.verifying'), value: verifying.toLocaleString('en'), icon: HourglassIcon, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {items.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
          >
            <GlassCard>
              <div className="flex items-center justify-between text-center sm:text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Transaction Row (Desktop)
   ═══════════════════════════════════════════ */

function TxnRow({ deal, user, onClick, t }: { deal: DealRow; user: any; onClick: () => void; t: (key: any) => string }) {
  const pStatus = getPaymentStatus(deal);
  const isBuyer = deal.buyerId === user?.id;
  const counterParty = isBuyer ? deal.seller?.name : deal.buyer?.name;
  const DirIcon = isBuyer ? ArrowUpRight : ArrowDownLeft;
  const dirColor = isBuyer ? 'text-red-500' : 'text-emerald-500';

  return (
    <tr
      className="border-b border-border/30 transition-colors hover:bg-accent/30 last:border-0 cursor-pointer"
      onClick={onClick}
    >
      <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(deal.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isBuyer ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
            <DirIcon className={`h-4 w-4 ${dirColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{deal.title}</p>
            <p className="text-xs text-muted-foreground">{counterParty || t('payment.waiting')}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-right font-semibold text-foreground whitespace-nowrap">
        {formatTaka(deal.paymentAmount || deal.amount)}
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        {deal.paymentMethod ? (
          <div className="flex items-center gap-1.5">
            {(() => { const MIcon = getMethodIcon(deal.paymentMethod.name); return <MIcon className="h-4 w-4 text-muted-foreground" />; })()}
            <span className="text-xs text-muted-foreground">{deal.paymentMethod.name}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        {deal.transactionId ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono text-muted-foreground truncate max-w-[100px]">{deal.transactionId}</span>
            <CopyBtn text={deal.transactionId} t={t} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-center whitespace-nowrap">
        {getPaymentStatusBadge(pStatus, t)}
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════
   Transaction Card (Mobile)
   ═══════════════════════════════════════════ */

function TxnCard({ deal, user, onClick, t }: { deal: DealRow; user: any; onClick: () => void; t: (key: any) => string }) {
  const pStatus = getPaymentStatus(deal);
  const isBuyer = deal.buyerId === user?.id;
  const counterParty = isBuyer ? deal.seller?.name : deal.buyer?.name;
  const DirIcon = isBuyer ? ArrowUpRight : ArrowDownLeft;
  const dirColor = isBuyer ? 'text-red-500' : 'text-emerald-500';

  return (
    <GlassCard className="!p-0 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={onClick}>
      <div className="p-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isBuyer ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
          <DirIcon className={`h-5 w-5 ${dirColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counterParty || t('payment.waiting')} · {new Date(deal.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{formatTaka(deal.paymentAmount || deal.amount)}</p>
          <div className="mt-1">{getPaymentStatusBadge(pStatus, t)}</div>
        </div>
      </div>
    </GlassCard>
  );
}

/* ─── Filter Tabs ─── */
function getFilterTabs(t: (key: any) => string): { key: 'all' | PaymentStatus; label: string; icon: typeof Receipt }[] {
  return [
    { key: 'all', label: t('payment.all'), icon: ArrowUpDown },
    { key: 'paid', label: t('status.paid'), icon: CheckCircle2 },
    { key: 'unpaid', label: t('status.unpaid'), icon: XCircle },
    { key: 'verifying', label: t('status.verifying'), icon: HourglassIcon },
    { key: 'wrong_info', label: t('status.wrongInfo'), icon: ShieldAlert },
    { key: 'cancelled', label: t('status.cancelled'), icon: Ban },
  ];
}

/* ═══════════════════════════════════════════
   Skeleton
   ═══════════════════════════════════════════ */

function TableSkeleton() {
  return (
    <GlassCard className="!p-0 overflow-hidden">
      <div className="p-5 pb-3 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-52 animate-pulse rounded bg-muted" />
      </div>
      <div className="border-t border-border/50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/30 px-5 py-3.5 last:border-0"
          >
            <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
            <div className="h-9 w-9 animate-pulse rounded-xl bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function StatCardSkeleton() {
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-14 sm:w-20 animate-pulse rounded bg-muted" />
          <div className="h-6 sm:h-7 w-8 sm:w-12 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-10 sm:h-11 sm:w-11 animate-pulse rounded-xl bg-muted" />
      </div>
    </GlassCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — Transaction Ledger (Dashboard Style)
   ═══════════════════════════════════════════════════════════════ */
export function UserPaymentView() {
  const user = useAppStore((s) => s.user);
  const { setDashboardPanel } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | PaymentStatus>('all');
  const [search, setSearch] = useState('');

  const fetchDeals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/user/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeals(data);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleDealClick = (deal: DealRow) => {
    useAppStore.getState().setActiveDeal(deal);
    setDashboardPanel('deal-detail');
  };

  /* Filter & Search */
  const filtered = deals.filter((d) => {
    if (filter !== 'all' && getPaymentStatus(d) !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.transactionId?.toLowerCase().includes(q) ||
        d.senderNumber?.toLowerCase().includes(q) ||
        (d.seller?.name || '').toLowerCase().includes(q) ||
        (d.buyer?.name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!mounted || !user) return null;

  const FILTER_TABS = getFilterTabs(t);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Page Header Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-4 sm:p-5 flex items-center gap-3"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Banknote className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {t('payment.title')}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground truncate">
            {t('payment.subtitle')}
          </p>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : deals.length > 0 ? (
        <StatCards deals={deals} t={t} />
      ) : null}

      {/* ── Search & Filter ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="space-y-3"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('payment.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.key === 'all' ? deals.length : deals.filter((d) => getPaymentStatus(d) === tab.key).length;
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                <span className={`text-[10px] font-semibold ${active ? 'text-primary-foreground/80' : 'text-muted-foreground/60'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Content ── */}
      {loading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <TableSkeleton />
        </motion.div>
      ) : filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 mb-3">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('payment.noTxnFound')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? t('payment.tryOther') : t('payment.noDealsYet')}
          </p>
        </GlassCard>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          {/* Desktop Table */}
          <div className="hidden md:block">
            <GlassCard className="!p-0 overflow-hidden">
              <div className="p-5 pb-3 text-center lg:text-left">
                <h3 className="text-base font-semibold text-foreground">{t('payment.txnList')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('payment.txnCount', { count: filtered.length.toLocaleString('en') })}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-b border-border/50 bg-muted/30">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('payment.date')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('payment.deal')}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('dashboard.amount')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('payment.method')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Txn ID</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('dashboard.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((deal) => (
                      <TxnRow key={deal.id} deal={deal} user={user} onClick={() => handleDealClick(deal)} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((deal) => (
              <TxnCard key={deal.id} deal={deal} user={user} onClick={() => handleDealClick(deal)} t={t} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}