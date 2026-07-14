'use client';

import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Wallet,
  TrendingUp,
  Handshake,
  ClipboardList,
  ArrowUpRight,
} from 'lucide-react';
import { NewDealForm } from './new-deal-form';
import { DealWorkflowTracker } from './deal-workflow-tracker';
import { UserPaymentView } from './user-payment-view';
import { MyDealsPanel } from './my-deals-panel';
import { ProfilePanel } from './profile-panel';
import { SettingsPanel } from './settings-panel';
import { BackButton } from '@/components/shared/back-button';

const emptySubscribe = () => () => {};

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface UserStats {
  activeDeals: number;
  completedDeals: number;
  totalDeals: number;
  totalTransactionAmount: number;
  availableBalance: number;
  heldAmount: number;
  totalBalance: number;
}

interface RecentDeal {
  id: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

/** Map DB status → Bengali display label for the overview table */
function getDisplayStatus(status: string): string {
  switch (status) {
    case 'payment_verified':
    case 'verified':
    case 'in_delivery':
    case 'delivery':
      return 'টাকা জমা';
    case 'created':
    case 'payment_pending':
      return 'চলমান';
    case 'completed':
      return 'সম্পন্ন';
    case 'cancelled':
    case 'rejected':
      return 'বাতিল';
    case 'disputed':
      return 'বিরোধ';
    default:
      return status;
  }
}

function statusBadge(status: string) {
  const display = getDisplayStatus(status);
  switch (display) {
    case 'টাকা জমা':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">
          {display}
        </Badge>
      );
    case 'চলমান':
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium">
          {display}
        </Badge>
      );
    case 'সম্পন্ন':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium">
          {display}
        </Badge>
      );
    case 'বাতিল':
      return (
        <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0 font-medium">
          {display}
        </Badge>
      );
    case 'বিরোধ':
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">
          {display}
        </Badge>
      );
    default:
      return <Badge variant="outline">{display}</Badge>;
  }
}

/** Format number as Bengali numerals with ৳ prefix */
function formatTaka(amount: number): string {
  return '৳' + Math.round(amount).toLocaleString('bn-BD');
}

/* ═══════════════════════════════════════════
   Glass Card helper
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

/* ═══════════════════════════════════════════
   Skeleton Components
   ═══════════════════════════════════════════ */

function StatCardSkeleton() {
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-14 sm:w-20 animate-pulse rounded bg-muted" />
          <div className="h-6 sm:h-7 w-12 sm:w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-10 sm:h-11 sm:w-11 animate-pulse rounded-xl bg-muted" />
      </div>
    </GlassCard>
  );
}

function BalanceRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-5 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <GlassCard className="!p-0 overflow-hidden">
      <div className="p-5 pb-3 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="border-t border-border/50">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/30 px-5 py-3.5 last:border-0"
          >
            <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-36 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ═══════════════════════════════════════════
   Overview Panel (real data)
   ═══════════════════════════════════════════ */

function OverviewPanel() {
  const user = useAppStore((s) => s.user);
  const setDashboardPanel = useAppStore((s) => s.setDashboardPanel);
  const userId = user?.id;

  /* ── Queries ── */
  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['user-dashboard-stats', userId],
    queryFn: async () => {
      const res = await fetch('/api/user/dashboard-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: deals, isLoading: dealsLoading } = useQuery<RecentDeal[]>({
    queryKey: ['user-recent-deals', userId],
    queryFn: async () => {
      const res = await fetch('/api/user/recent-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to fetch deals');
      return res.json();
    },
    enabled: !!userId,
  });

  /* ── Derived stat cards ── */
  const statCards = stats
    ? [
        {
          label: 'চলতি ডিল',
          value: stats.activeDeals.toLocaleString('bn-BD'),
          icon: Handshake,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          label: 'সফল ডিল',
          value: stats.completedDeals.toLocaleString('bn-BD'),
          icon: TrendingUp,
          color: 'text-emerald-500 dark:text-emerald-400',
          bg: 'bg-emerald-500/10',
        },
        {
          label: 'মোট লেনদেন (৳)',
          value: stats.totalTransactionAmount.toLocaleString('bn-BD'),
          icon: Wallet,
          color: 'text-amber-500 dark:text-amber-400',
          bg: 'bg-amber-500/10',
        },
        {
          label: 'মোট ডিল',
          value: stats.totalDeals.toLocaleString('bn-BD'),
          icon: ClipboardList,
          color: 'text-blue-500 dark:text-blue-400',
          bg: 'bg-blue-500/10',
        },
      ]
    : [];

  return (
    <>
      {/* ── Welcome Banner ── */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-5 sm:p-6 flex items-center gap-4">
        <button
          onClick={() => setDashboardPanel('profile')}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:scale-105 transition-transform"
          aria-label="প্রোফাইল"
        >
          {user?.name?.charAt(0) || 'ই'}
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            স্বাগতম, <span className="text-primary">{user?.name?.split(' ')[0] || 'ইউজার'}</span> 👋
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground truncate">
            আজকের ডিল ও লেনদেনের সারসংক্ষেপ
          </p>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <GlassCard>
                    <div className="flex items-center justify-between text-center sm:text-left">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}
                      >
                        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
      </div>

      {/* ── Activity Grid: Quick Actions + Balance / Recent Deals ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Right Column → Quick Actions + Balance (order-1 mobile, order-2 desktop) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="order-1 lg:order-2 lg:col-span-2"
        >
          <GlassCard className="flex flex-col items-center gap-5 text-center">
            {/* CTA Button */}
            <div className="w-full">
              <h3 className="mb-4 text-base font-semibold text-foreground flex items-center justify-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-primary" />
                কুইক অ্যাকশন
              </h3>
              <div className="w-full space-y-2.5 px-5">
              <Button
                onClick={() => setDashboardPanel('new-deal')}
                className="w-full h-12 rounded-lg text-base font-semibold shadow-lg shadow-primary/25 dark:glow-lime gap-2.5"
              >
                <Plus className="h-5 w-5" />
                নতুন ডিল তৈরি করুন
              </Button>
              <Button
                onClick={() => setDashboardPanel('my-deals')}
                variant="outline"
                className="w-full h-12 rounded-lg text-base font-semibold gap-2.5"
              >
                <ClipboardList className="h-5 w-5" />
                আমার ডিল
              </Button>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full border-t border-border/50" />

            {/* Balance Summary */}
            <div className="w-full">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                অ্যাকাউন্ট সারসংক্ষেপ
              </h3>
              {statsLoading ? (
                <div className="space-y-3">
                  <BalanceRowSkeleton />
                  <BalanceRowSkeleton />
                  <BalanceRowSkeleton />
                </div>
              ) : stats ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      উপলব্ধ ব্যালেন্স
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {formatTaka(stats.availableBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      হোল্ড থাকা টাকা
                    </span>
                    <span className="text-base font-bold text-amber-500 dark:text-amber-400">
                      {formatTaka(stats.heldAmount)}
                    </span>
                  </div>
                  <div className="border-t border-border/40 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        মোট ব্যালেন্স
                      </span>
                      <span className="text-base font-bold text-foreground">
                        {formatTaka(stats.totalBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </GlassCard>
        </motion.div>

        {/* Left Column → Recent Deals Table (order-2 mobile, order-1 desktop) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="order-2 lg:order-1 lg:col-span-3"
        >
          {dealsLoading ? (
            <TableSkeleton />
          ) : deals && deals.length > 0 ? (
            <GlassCard className="!p-0 overflow-hidden">
              <div className="p-5 pb-3 text-center lg:text-left">
                <h3 className="text-base font-semibold text-foreground">
                  সাম্প্রতিক ডিলসমূহ
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  সাম্প্রতিক সকল ডিলের তালিকা
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-b border-border/50 bg-muted/30">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        ডিল আইডি
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        শিরোনাম
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        পরিমাণ
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        অবস্থা
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.slice(0, 5).map((deal) => (
                      <tr
                        key={deal.id}
                        className="border-b border-border/30 transition-colors hover:bg-accent/30 last:border-0"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {deal.id.slice(0, 10)}…
                        </td>
                        <td className="px-5 py-3.5 font-medium text-foreground max-w-[180px] truncate">
                          {deal.title}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-foreground whitespace-nowrap">
                          {formatTaka(deal.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {statusBadge(deal.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
              <Handshake className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                কোনো ডিল নেই
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                নতুন ডিল তৈরি করে শুরু করুন
              </p>
            </GlassCard>
          )}
        </motion.div>
      </div>
    </>
  );
}

/* ─── Main Content ─── */
export function DashboardMain() {
  const dashboardPanel = useAppStore((s) => s.dashboardPanel);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  // Deal-detail and payment panels fill full height on mobile for no-scroll layout
  const isImmersive = dashboardPanel === 'deal-detail' || dashboardPanel === 'payment';

  return (
    <div className={`${isImmersive ? 'flex-1 min-h-0 flex flex-col p-3 sm:p-6 lg:px-6 lg:py-8 h-[calc(100vh-4rem)] sm:h-auto' : 'flex-1 p-4 sm:p-6 lg:px-6 lg:py-8'}`}>
      {/* Back button for sub-panels (not overview, not immersive) */}
      {!isImmersive && dashboardPanel !== 'overview' && (
        <div className="mb-4">
          <BackButton />
        </div>
      )}
      {dashboardPanel === 'overview' && <OverviewPanel />}
      {dashboardPanel === 'new-deal' && <NewDealForm />}
      {dashboardPanel === 'my-deals' && <MyDealsPanel />}
      {dashboardPanel === 'deal-detail' && <DealWorkflowTracker />}
      {dashboardPanel === 'payment' && <UserPaymentView />}
      {dashboardPanel === 'profile' && <ProfilePanel />}
      {dashboardPanel === 'settings' && <SettingsPanel />}
    </div>
  );
}