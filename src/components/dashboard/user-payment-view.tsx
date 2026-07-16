'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

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

function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'paid': return 'পেইড';
    case 'unpaid': return 'আনপেইড';
    case 'verifying': return 'ভেরিফাই হচ্ছে';
    case 'wrong_info': return 'ভুল তথ্য';
    case 'cancelled': return 'বাতিল';
  }
}

function getPaymentStatusConfig(status: PaymentStatus) {
  switch (status) {
    case 'paid':
      return { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' };
    case 'unpaid':
      return { icon: XCircle, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20' };
    case 'verifying':
      return { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' };
    case 'wrong_info':
      return { icon: AlertCircle, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' };
    case 'cancelled':
      return { icon: XCircle, color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-50 dark:bg-zinc-500/10', border: 'border-zinc-200 dark:border-zinc-500/20' };
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

function formatBnDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('bn-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Copy Button ─── */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" title="কপি করুন">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ─── Summary Cards ─── */
function SummaryCards({ deals }: { deals: DealRow[] }) {
  const totalDeals = deals.length;
  const paid = deals.filter((d) => getPaymentStatus(d) === 'paid').length;
  const unpaid = deals.filter((d) => getPaymentStatus(d) === 'unpaid').length;
  const verifying = deals.filter((d) => getPaymentStatus(d) === 'verifying').length;

  const cards = [
    { label: 'মোট লেনদেন', value: totalDeals, icon: ArrowUpRight, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'পেইড', value: paid, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'আনপেইড', value: unpaid, icon: XCircle, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    { label: 'ভেরিফাই হচ্ছে', value: verifying, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-border/50 bg-white p-3.5 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bg}`}>
                <Icon className={`h-[18px] w-[18px] ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Transaction Row (Desktop Table Row) ─── */
function TxnRow({ deal, user, onClick }: { deal: DealRow; user: any; onClick: () => void }) {
  const pStatus = getPaymentStatus(deal);
  const config = getPaymentStatusConfig(pStatus);
  const StatusIcon = config.icon;

  const isBuyer = deal.buyerId === user?.id;
  const counterParty = isBuyer ? deal.seller?.name : deal.buyer?.name;
  const dirIcon = isBuyer ? ArrowUpRight : ArrowDownLeft;
  const DirIcon = dirIcon;
  const dirColor = isBuyer ? 'text-red-500' : 'text-emerald-500';
  const dirLabel = isBuyer ? 'প্রদান' : 'গ্রহণ';

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Date */}
      <td className="py-3.5 px-3 text-sm text-muted-foreground whitespace-nowrap">
        {new Date(deal.createdAt).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })}
      </td>

      {/* Deal */}
      <td className="py-3.5 px-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isBuyer ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
            <DirIcon className={`h-4 w-4 ${dirColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate max-w-[180px]">{deal.title}</p>
            <p className="text-[11px] text-muted-foreground">{counterParty || 'অপেক্ষমান'}</p>
          </div>
        </div>
      </td>

      {/* Amount */}
      <td className="py-3.5 px-3 text-right whitespace-nowrap">
        <p className="text-sm font-bold text-foreground">৳{(deal.paymentAmount || deal.amount).toLocaleString('bn-BD')}</p>
        {deal.paymentAmount && deal.paymentAmount !== deal.amount && (
          <p className="text-[10px] text-muted-foreground line-through">৳{deal.amount.toLocaleString('bn-BD')}</p>
        )}
      </td>

      {/* Method */}
      <td className="py-3.5 px-3 whitespace-nowrap">
        {deal.paymentMethod ? (
          <div className="flex items-center gap-1.5">
            {(() => { const MIcon = getMethodIcon(deal.paymentMethod.name); return <MIcon className="h-3.5 w-3.5 text-muted-foreground" />; })()}
            <span className="text-xs text-muted-foreground">{deal.paymentMethod.name}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>

      {/* Txn ID */}
      <td className="py-3.5 px-3 whitespace-nowrap">
        {deal.transactionId ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono text-muted-foreground truncate max-w-[100px]">{deal.transactionId}</span>
            <CopyBtn text={deal.transactionId} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3.5 px-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${config.color} ${config.bg} ${config.border}`}>
          <StatusIcon className="h-3 w-3" />
          {getPaymentStatusLabel(pStatus)}
        </span>
      </td>
    </motion.tr>
  );
}

/* ─── Transaction Card (Mobile) ─── */
function TxnCard({ deal, user, onClick }: { deal: DealRow; user: any; onClick: () => void }) {
  const pStatus = getPaymentStatus(deal);
  const config = getPaymentStatusConfig(pStatus);
  const StatusIcon = config.icon;

  const isBuyer = deal.buyerId === user?.id;
  const counterParty = isBuyer ? deal.seller?.name : deal.buyer?.name;
  const dirIcon = isBuyer ? ArrowUpRight : ArrowDownLeft;
  const DirIcon = dirIcon;
  const dirColor = isBuyer ? 'text-red-500' : 'text-emerald-500';
  const dirLabel = isBuyer ? 'প্রদান' : 'গ্রহণ';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-border/50 bg-white p-4 dark:bg-zinc-900 cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isBuyer ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
            <DirIcon className={`h-5 w-5 ${dirColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">{deal.title}</p>
            <p className="text-[11px] text-muted-foreground">{counterParty || 'অপেক্ষমান'} · {new Date(deal.createdAt).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${config.color} ${config.bg} ${config.border}`}>
          <StatusIcon className="h-2.5 w-2.5" />
          {getPaymentStatusLabel(pStatus)}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-xl font-extrabold text-foreground">৳{(deal.paymentAmount || deal.amount).toLocaleString('bn-BD')}</p>
          {deal.paymentMethod && (
            <div className="flex items-center gap-1.5 mt-1">
              {(() => { const MIcon = getMethodIcon(deal.paymentMethod.name); return <MIcon className="h-3 w-3 text-muted-foreground" />; })()}
              <span className="text-[11px] text-muted-foreground">{deal.paymentMethod.name}</span>
              {deal.transactionId && (
                <>
                  <span className="text-[11px] text-muted-foreground/40">·</span>
                  <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[80px]">{deal.transactionId}</span>
                </>
              )}
            </div>
          )}
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/50" />
      </div>
    </motion.div>
  );
}

/* ─── Filter Tabs ─── */
const FILTER_TABS: { key: 'all' | PaymentStatus; label: string }[] = [
  { key: 'all', label: 'সব' },
  { key: 'paid', label: 'পেইড' },
  { key: 'unpaid', label: 'আনপেইড' },
  { key: 'verifying', label: 'ভেরিফাই হচ্ছে' },
  { key: 'wrong_info', label: 'ভুল তথ্য' },
  { key: 'cancelled', label: 'বাতিল' },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — Transaction Ledger
   ═══════════════════════════════════════════════════════════════ */
export function UserPaymentView() {
  const user = useAppStore((s) => s.user);
  const { setActiveDeal, setDashboardPanel } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

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

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">লেনদেন</h1>
        <p className="text-sm text-muted-foreground mt-1">আপনার সকল ডিল পেমেন্ট ট্রানজেকশনের হিসাব</p>
      </div>

      {/* Summary Cards */}
      {!loading && <SummaryCards deals={deals} />}

      {/* Search + Filter */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ডিল, ট্রানজেকশন আইডি, নম্বর দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-xl border border-border/50 bg-white pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 dark:bg-zinc-900 transition-colors"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'all' ? deals.length : deals.filter((d) => getPaymentStatus(d) === tab.key).length;
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-3">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">কোনো লেনদেন পাওয়া যায়নি</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? 'অন্য কিছু দিয়ে খুঁজুন' : 'আপনার এখনো কোনো ডিল নেই'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-border/50 bg-white dark:bg-zinc-900 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">তারিখ</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ডিল</th>
                  <th className="py-3 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">পরিমাণ</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">মেথড</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ট্রানজেকশন আইডি</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal) => (
                  <TxnRow key={deal.id} deal={deal} user={user} onClick={() => handleDealClick(deal)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((deal) => (
              <TxnCard key={deal.id} deal={deal} user={user} onClick={() => handleDealClick(deal)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}