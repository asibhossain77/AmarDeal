'use client';

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, type DealStatus } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SellerDealTracker } from './seller-deal-tracker';
import { BackButton } from '@/components/shared/back-button';
import {
  Bell,
  Menu,
  Inbox,
  Clock,
  TrendingUp,
  Plus,
  Truck,
  Pencil,
  Loader2,
  PackageCheck,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

const emptySubscribe = () => () => {};

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface DealRow {
  id: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
  buyer?: { id: string; name: string; email: string; phone: string } | null;
  seller?: { id: string; name: string; email: string; phone: string } | null;
  creator?: { id: string; name: string; email: string } | null;
}

/* ═══════════════════════════════════════════
   Card Helper
   ═══════════════════════════════════════════ */

function SolidCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-lg dark:bg-zinc-900 ${className}`}>
      {children}
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'created':
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 font-medium">তৈরি হয়েছে</Badge>;
    case 'payment_pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">পেমেন্ট পেন্ডিং</Badge>;
    case 'payment_verified':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium">ভেরিফাইড</Badge>;
    case 'in_delivery':
      return <Badge className="bg-primary/15 text-primary dark:bg-primary/20 border-0 font-medium">ডেলিভারি চলছে</Badge>;
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium">সম্পন্ন</Badge>;
    case 'cancelled':
      return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0 font-medium">বাতিল</Badge>;
    case 'disputed':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">বিরোধ</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/* ═══════════════════════════════════════════
   Panel: Overview
   ═══════════════════════════════════════════ */

function SellerOverviewPanel() {
  const user = useAppStore((s) => s.user);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const [stats, setStats] = useState({ incoming: 0, active: 0, completed: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/seller/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        if (res.ok) {
          const data: DealRow[] = await res.json();
          setStats({
            incoming: data.filter(d => d.status === 'created' || d.status === 'payment_pending').length,
            active: data.filter(d => d.status === 'payment_verified' || d.status === 'in_delivery').length,
            completed: data.filter(d => d.status === 'completed').length,
            totalEarnings: data.filter(d => d.status === 'completed').reduce((sum, d) => sum + d.amount, 0),
          });
        }
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user?.id]);

  const cards = [
    { label: 'ইনকামিং ডিল', value: loading ? '...' : stats.incoming.toLocaleString('bn-BD'), icon: Inbox, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'চলমান ডিল', value: loading ? '...' : stats.active.toLocaleString('bn-BD'), icon: Clock, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'মোট আয় (৳)', value: loading ? '...' : Math.round(stats.totalEarnings).toLocaleString('bn-BD'), icon: TrendingUp, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors lg:hidden"
            aria-label="মেনু"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-center lg:text-left">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              স্বাগতম, {user?.name?.split(' ')[0] || 'বিক্রেতা'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              আপনার বিক্রয় ড্যাশবোর্ডের সারসংক্ষেপ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="নোটিফিকেশন">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
            {user?.name?.charAt(0) || 'ব'}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
              <SolidCard>
                <div className="flex items-center justify-between text-center sm:text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </SolidCard>
            </motion.div>
          );
        })}
      </div>

      {/* Quick summary */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
        <SolidCard className="flex flex-col items-center gap-4 text-center">
          <div className="w-full">
            <h3 className="mb-3 text-base font-semibold text-foreground">এই সপ্তাহের সারসংক্ষেপ</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">সম্পন্ন ডিল</span>
                <span className="text-base font-bold text-emerald-500">{loading ? '...' : stats.completed.toLocaleString('bn-BD')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">মোট আয়</span>
                <span className="text-base font-bold text-foreground">৳{loading ? '...' : Math.round(stats.totalEarnings).toLocaleString('bn-BD')}</span>
              </div>
            </div>
          </div>
        </SolidCard>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════
   Panel: Active Deals (Real DB Data)
   ═══════════════════════════════════════════ */

function ActiveDealsPanel() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  const user = useAppStore((s) => s.user);

  const fetchDeals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/seller/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data: DealRow[] = await res.json();
        setDeals(data);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleOpenDeal = (deal: DealRow) => {
    useAppStore.getState().setActiveDeal({
      id: deal.id,
      title: deal.title,
      amount: deal.amount,
      status: deal.status as DealStatus,
      createdAt: deal.createdAt,
      buyerId: deal.buyer?.id,
      sellerId: deal.seller?.id,
      creatorId: deal.creator?.id,
      buyerName: deal.buyer?.name,
      sellerName: deal.seller?.name,
    });
    useAppStore.getState().setSellerPanel('deal-detail');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="text-center lg:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">চলমান ডিলসমূহ</h2>
        <p className="mt-1 text-sm text-muted-foreground">বর্তমানে চলমান সকল ডিলের তালিকা</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : deals.length === 0 ? (
        <SolidCard className="text-center py-12">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">কোনো ডিল পাওয়া যায়নি</p>
        </SolidCard>
      ) : (
        <SolidCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">ডিল আইডি</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">শিরোনাম</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">ক্রেতা</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">পরিমাণ</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">স্ট্যাটাস</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b border-border/30 transition-colors hover:bg-accent/30 last:border-0">
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      DL-{deal.id.slice(-5)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground whitespace-nowrap max-w-[160px] truncate">{deal.title}</td>
                    <td className="px-5 py-3.5 text-foreground whitespace-nowrap">{deal.buyer?.name || '---'}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-foreground whitespace-nowrap">
                      ৳{deal.amount.toLocaleString('bn-BD')}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">{getStatusBadge(deal.status)}</td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <Button
                        size="sm"
                        onClick={() => handleOpenDeal(deal)}
                        className="h-8 gap-1.5 rounded-lg text-xs font-semibold shadow-md shadow-primary/20"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        দেখুন
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SolidCard>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   Panel: My Products (Placeholder)
   ═══════════════════════════════════════════ */

function MyProductsPanel() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-center sm:text-left">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">আমার পণ্যসমূহ</h2>
          <p className="mt-1 text-sm text-muted-foreground">আপনার বিক্রয়যোগ্য পণ্যের তালিকা</p>
        </div>
        <Button onClick={() => toast.info('নতুন পণ্য যোগ করার পেজে নিচ্ছি...')} className="rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 gap-2 sm:self-start">
          <Plus className="h-4 w-4" />
          নতুন পণ্য যোগ করুন
        </Button>
      </div>
      <SolidCard className="text-center py-12">
        <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">এখনো কোনো পণ্য যোগ করা হয়নি</p>
      </SolidCard>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   Main Content Router
   ═══════════════════════════════════════════ */

export function SellerMain() {
  const sellerPanel = useAppStore((s) => s.sellerPanel);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      {sellerPanel !== 'overview' && sellerPanel !== 'deal-detail' && (
        <div className="mb-4">
          <BackButton />
        </div>
      )}
      {sellerPanel === 'overview' && <SellerOverviewPanel />}
      {sellerPanel === 'active-deals' && <ActiveDealsPanel />}
      {sellerPanel === 'deal-detail' && <SellerDealTracker />}
      {sellerPanel === 'my-products' && <MyProductsPanel />}
    </div>
  );
}