'use client';

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, type DealStatus } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, Inbox, Copy, Check, Search, X } from 'lucide-react';
import { useT } from '@/lib/i18n';

const emptySubscribe = () => () => {};

interface DealRow {
  id: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
  rejectionReason?: string | null;
  buyer?: { id: string; name: string; email: string; phone: string } | null;
  seller?: { id: string; name: string; email: string; phone: string } | null;
  creator?: { id: string; name: string; email: string } | null;
}

function getStatusBadge(status: string, t: (key: any) => string) {
  switch (status) {
    case 'created':
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 font-medium">{t('status.created')}</Badge>;
    case 'payment_pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">{t('status.paymentPending')}</Badge>;
    case 'payment_verified':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium">{t('status.verified')}</Badge>;
    case 'in_delivery':
      return <Badge className="bg-primary/15 text-primary dark:bg-primary/20 border-0 font-medium">{t('status.inDelivery')}</Badge>;
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium">{t('status.completed')}</Badge>;
    case 'cancelled':
      return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0 font-medium">{t('status.cancelled')}</Badge>;
    case 'disputed':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">{t('status.disputed')}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function MyDealsPanel() {
  const user = useAppStore((s) => s.user);
  const setDashboardPanel = useAppStore((s) => s.setDashboardPanel);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const t = useT();

  const fetchDeals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/deals', {
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
      rejectionReason: deal.rejectionReason,
    });
    setDashboardPanel('deal-detail');
  };

  const filteredDeals = deals.filter((d) => {
    // Status filter
    if (filter === 'active') {
      if (!['created', 'payment_pending', 'payment_verified', 'in_delivery'].includes(d.status)) return false;
    }
    if (filter === 'completed') {
      if (d.status !== 'completed') return false;
    }
    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const shortId = 'dl-' + d.id.slice(-5).toLowerCase();
      const fullId = d.id.toLowerCase();
      const title = d.title.toLowerCase();
      if (!shortId.includes(q) && !fullId.includes(q) && !title.includes(q)) return false;
    }
    return true;
  });

  const handleCopyId = (dealId: string) => {
    const shortId = 'DL-' + dealId.slice(-5);
    navigator.clipboard.writeText(shortId).then(() => {
      setCopiedId(dealId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (!mounted) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="text-center lg:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('deals.myDeals')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('deals.myDealsDesc')}</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('deals.searchPlaceholder')}
          className="w-full h-10 rounded-xl border border-border/50 bg-white dark:bg-zinc-900 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 shadow-lg"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              filter === tab
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'bg-white dark:bg-zinc-900 text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground shadow-lg'
            }`}
          >
            {tab === 'all' ? t('deals.all') : tab === 'active' ? t('status.active') : t('status.completed')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-6 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search.trim() ? t('deals.searchNoResult', { search }) : t('deals.noDealFound')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDeals.map((deal, i) => (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-4 sm:p-5 border border-border/50"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyId(deal.id); }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 hover:bg-muted px-2 py-0.5 transition-colors group"
                      title={t('deals.copy')}
                    >
                      <span className="font-mono text-xs font-semibold text-primary">{`DL-${deal.id.slice(-5)}`}</span>
                      {copiedId === deal.id ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {new Date(deal.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-base font-semibold text-foreground truncate">{deal.title}</p>
                  <p className="text-lg font-bold text-primary mt-1">৳{deal.amount.toLocaleString('en')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(deal.status, t)}
                  <Button
                    size="sm"
                    onClick={() => handleOpenDeal(deal)}
                    className="h-8 gap-1.5 rounded-lg text-xs font-semibold shadow-md shadow-primary/20"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('deals.view')}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}