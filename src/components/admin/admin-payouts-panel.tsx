'use client';
import { useT } from '@/lib/i18n';

import { useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Wallet,
  Loader2,
  CheckCircle,
  Clock,
  Banknote,
  CircleDollarSign,
  Inbox,
} from 'lucide-react';

const emptySubscribe = () => () => {};

/* ═══════════════════════════════════════════
   Color Constants
   ═══════════════════════════════════════════ */

const PARROT_GREEN = '#65A30D';
const PARROT_GREEN_LIGHT = '#84CC16';
const PARROT_GREEN_GLOW = '0 4px 16px rgba(101, 163, 13, 0.30)';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface PayoutRow {
  id: string;
  dealId: string;
  type: 'seller_payout' | 'buyer_refund';
  recipientId: string;
  amount: number;
  accountType: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'paid';
  paidAt: string | null;
  createdAt: string;
  deal: {
    id: string;
    title: string;
    status: string;
  };
  recipient: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

type FilterTab = 'all' | 'pending' | 'paid' | 'seller_payout' | 'buyer_refund';

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function getAccountTypeLabel(type: string): string {
  switch (type) {
    case 'bkash': return 'bKash';
    case 'nagad': return 'Nagad';
    case 'rocket': return 'Rocket';
    case 'bank': return 'Bank Transfer';
    default: return type;
  }
}

function getAccountTypeColor(type: string): string {
  switch (type) {
    case 'bkash': return '#E2136E';
    case 'nagad': return '#F6921E';
    case 'rocket': return '#8C3494';
    case 'bank': return '#1A56DB';
    default: return '#6B7280';
  }
}

function formatAmount(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en')}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ═══════════════════════════════════════════
   GlassCard class
   ═══════════════════════════════════════════ */

const GLASS_CARD =
  'relative rounded-2xl border !border-white/60 !bg-white/40 p-3.5 sm:p-5 shadow-xl !backdrop-blur-xl dark:!border-zinc-800/50 dark:!bg-zinc-900/50 dark:!backdrop-blur-xl';

/* ═══════════════════════════════════════════
   Skeleton
   ═══════════════════════════════════════════ */

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className={GLASS_CARD}>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

function PayoutCardSkeleton() {
  return (
    <div className={GLASS_CARD}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="text-right space-y-1.5">
          <Skeleton className="h-5 w-20 ml-auto" />
          <Skeleton className="h-5 w-14 ml-auto" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border/30">
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-11 w-28 rounded-xl" />
      </div>
    </div>
  );
}

function PayoutListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <PayoutCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function AdminPayoutsPanel() {
  const t = useT();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);

  /* ── Filter tabs (need t() for labels) ── */
  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('admin.payouts.all') },
    { key: 'pending', label: t('admin.payouts.pending') },
    { key: 'paid', label: t('admin.payouts.paid') },
    { key: 'seller_payout', label: t('admin.payouts.sellerPayout') },
    { key: 'buyer_refund', label: t('admin.payouts.buyerRefund') },
  ];

  /* ── Payout type label (needs t()) ── */
  const getPayoutTypeLabel = (type: string): string => {
    switch (type) {
      case 'seller_payout': return t('admin.payouts.sellerPayout');
      case 'buyer_refund': return t('admin.payouts.buyerRefund');
      default: return type;
    }
  };

  /* ── Build query params ── */
  const getQueryParams = () => {
    if (activeTab === 'all') return '';
    if (activeTab === 'pending' || activeTab === 'paid') return `?status=${activeTab}`;
    return `?type=${activeTab}`;
  };

  /* ── Fetch payouts with useQuery ── */
  const { data, isLoading, refetch } = useQuery<{
    payouts: PayoutRow[];
  }>({
    queryKey: ['admin-payouts', activeTab],
    queryFn: async () => {
      const params = getQueryParams();
      const res = await fetch(`/api/admin/payouts${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('admin.payouts.loadError'));
      }
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const payouts = data?.payouts ?? [];

  /* ── Stats (always computed from all payouts) ── */
  const { data: allData } = useQuery<{
    payouts: PayoutRow[];
  }>({
    queryKey: ['admin-payouts', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/admin/payouts');
      if (!res.ok) return { payouts: [] };
      return res.json();
    },
    staleTime: 30_000,
  });

  const allPayouts = allData?.payouts ?? [];
  const pendingCount = allPayouts.filter((p) => p.status === 'pending').length;
  const paidCount = allPayouts.filter((p) => p.status === 'paid').length;
  const totalPendingAmount = allPayouts
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  /* ── Mark as paid ── */
  const handleComplete = async (id: string) => {
    if (!window.confirm(t('admin.payouts.confirmMarkPaid'))) {
      return;
    }

    setCompletingId(id);
    try {
      const res = await fetch(`/api/admin/payouts/${id}/complete`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success(t('admin.payouts.completeSuccess'));
        queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || t('admin.payouts.completeFailed'));
      }
    } catch {
      toast.error(t('admin.payouts.networkError'));
    } finally {
      setCompletingId(null);
    }
  };

  if (!mounted) return null;

  /* ── Active tab index for pill animation ── */
  const activeTabIndex = FILTER_TABS.findIndex((t) => t.key === activeTab);

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════
          Header
          ═══════════════════════════════════════ */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: PARROT_GREEN }}
          >
            <Wallet className="h-5 w-5 text-white" />
          </div>
          {t('admin.payouts.title')}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t('admin.payouts.desc')}
        </p>
      </div>

      {/* ═══════════════════════════════════════
          Stats Row (3 GlassCards)
          ═══════════════════════════════════════ */}
      {isLoading && !data ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Total Pending */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={GLASS_CARD}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}
              >
                <Clock className="h-5 w-5" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {t('admin.payouts.totalPending')}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {pendingCount.toLocaleString('en')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Total Paid */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className={GLASS_CARD}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
              >
                <CheckCircle className="h-5 w-5" style={{ color: '#10B981' }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {t('admin.payouts.totalPaid')}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {paidCount.toLocaleString('en')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Total Amount */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className={GLASS_CARD}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(101, 163, 13, 0.12)' }}
              >
                <Banknote className="h-5 w-5" style={{ color: PARROT_GREEN }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {t('admin.payouts.totalAmountPending')}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatAmount(totalPendingAmount)}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          Filter Tabs (parrot green pill style)
          ═══════════════════════════════════════ */}
      <div
        className="relative flex items-center gap-1 p-1 rounded-xl w-fit overflow-x-auto"
        style={{ backgroundColor: 'var(--muted)' }}
      >
        {/* Animated pill indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-lg"
          style={{
            backgroundColor: PARROT_GREEN,
            boxShadow: PARROT_GREEN_GLOW,
          }}
          animate={{
            x: `${activeTabIndex * 100}%`,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />

        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative z-10 px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap"
            style={{
              color: activeTab === tab.key ? '#fff' : 'var(--muted-foreground)',
              minWidth: 'auto',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          Payout List
          ═══════════════════════════════════════ */}
      {isLoading ? (
        <PayoutListSkeleton />
      ) : payouts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${GLASS_CARD} flex flex-col items-center justify-center py-16`}
        >
          <Inbox className="h-14 w-14 text-muted-foreground/25 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">
            {t('admin.payouts.noPayouts')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {t('admin.payouts.noPayoutsForFilter')}
          </p>
        </motion.div>
      ) : (
        <div
          className="payout-scroll space-y-3 max-h-96 overflow-y-auto pr-1"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${PARROT_GREEN}40 transparent`,
          }}
        >
          <style>{`
            .payout-scroll::-webkit-scrollbar { width: 5px; }
            .payout-scroll::-webkit-scrollbar-track { background: transparent; }
            .payout-scroll::-webkit-scrollbar-thumb {
              background: ${PARROT_GREEN}40;
              border-radius: 9999px;
            }
            .payout-scroll::-webkit-scrollbar-thumb:hover {
              background: ${PARROT_GREEN}60;
            }
          `}</style>
          <AnimatePresence mode="popLayout">
            {payouts.map((payout, idx) => (
              <motion.div
                key={payout.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className={GLASS_CARD}
              >
                {/* ── Top row: deal info + amount ── */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Type badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`border-0 font-medium text-[11px] px-2 py-0.5 ${
                          payout.type === 'seller_payout'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                        }`}
                      >
                        {getPayoutTypeLabel(payout.type)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        #{payout.id.slice(0, 8)}
                      </span>
                    </div>

                    {/* Deal title */}
                    <p className="text-sm font-semibold text-foreground truncate">
                      {payout.deal?.title || t('payment.deal')}
                    </p>

                    {/* Recipient name + phone */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {payout.recipient?.name || '---'}
                      </span>
                      {payout.recipient?.phone && (
                        <>
                          <span>·</span>
                          <span>{payout.recipient.phone}</span>
                        </>
                      )}
                    </div>

                    {/* Account info */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span
                        className="font-semibold"
                        style={{ color: getAccountTypeColor(payout.accountType) }}
                      >
                        {getAccountTypeLabel(payout.accountType)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-foreground/80">
                        {payout.accountNumber}
                      </span>
                    </div>

                    {/* Account holder */}
                    <p className="text-[11px] text-muted-foreground/70">
                      {t('admin.payouts.accountHolder', { name: payout.accountName || '---' })}
                    </p>
                  </div>

                  {/* Amount + Status */}
                  <div className="text-right shrink-0 space-y-1.5">
                    <p className="text-lg font-bold text-foreground">
                      {formatAmount(payout.amount)}
                    </p>
                    {payout.status === 'pending' ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium text-[11px]">
                        {t('admin.payouts.pending')}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium text-[11px]">
                        {t('admin.payouts.paid')}
                      </Badge>
                    )}
                    <p className="text-[11px] text-muted-foreground/70">
                      {formatDate(payout.createdAt)}
                    </p>
                  </div>
                </div>

                {/* ── Bottom row: action ── */}
                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                  <p className="text-[11px] text-muted-foreground/60">
                    {payout.status === 'paid' && payout.paidAt
                      ? t('admin.payouts.paidOn', { date: formatDate(payout.paidAt) })
                      : t('admin.payouts.waiting')}
                  </p>

                  {payout.status === 'pending' ? (
                    <Button
                      onClick={() => handleComplete(payout.id)}
                      disabled={completingId === payout.id}
                      className="h-11 rounded-xl text-sm font-semibold gap-2 text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        backgroundColor: PARROT_GREEN,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = PARROT_GREEN_LIGHT;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = PARROT_GREEN;
                      }}
                    >
                      {completingId === payout.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      {t('admin.payouts.hasBeenPaid')}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {t('admin.payouts.paid')}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}