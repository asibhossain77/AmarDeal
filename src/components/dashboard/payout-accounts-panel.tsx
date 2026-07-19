'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Banknote, Clock, Check, XCircle, ArrowLeft, Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

const PARROT_GREEN = '#65A30D';
const PARROT_GREEN_MILD = 'rgba(101, 163, 13, 0.10)';

interface PayoutRecord {
  id: string;
  dealId: string;
  type: string;
  recipientId: string;
  amount: number;
  accountType: string;
  accountNumber: string;
  accountName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deal: {
    id: string;
    title: string;
    status: string;
  };
}

function statusBadge(status: string, t: (key: any) => string) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          {t('status.pending')}
        </span>
      );
    case 'approved':
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          {t('status.completed')}
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          {t('status.rejected')}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {status}
        </span>
      );
  }
}

function typeLabel(type: string, t: (key: any) => string) {
  return type === 'seller_payout' ? t('payout.sellerPayout') : t('payout.buyerRefund');
}

export function PayoutAccountsPanel() {
  const { user, setDashboardPanel } = useAppStore();
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetch('/api/user/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => { if (!cancelled) setPayouts(data); })
      .catch(() => { if (!cancelled) toast.error(t('payout.loadError')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, t]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDashboardPanel('my-deals')}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:bg-accent hover:scale-105"
          aria-label={t('payout.goBack')}
        >
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t('payout.history')}</h2>
          <p className="text-xs text-muted-foreground">{t('payout.subtitle')}</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : payouts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl mb-4"
            style={{ backgroundColor: PARROT_GREEN_MILD }}
          >
            <Inbox className="h-8 w-8" style={{ color: PARROT_GREEN }} />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">{t('payout.noPayout')}</p>
          <p className="text-xs text-muted-foreground max-w-[250px]">
            {t('payout.noPayoutDesc')}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <AnimatePresence>
            {payouts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-3xl shadow-2xl border border-border/40 p-4 sm:p-5 space-y-3"
                style={{ backgroundColor: 'var(--card)' }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: PARROT_GREEN }}
                    >
                      <Banknote className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {p.deal.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {typeLabel(p.type, t)} · DL-{p.dealId.slice(-5)}
                      </p>
                    </div>
                  </div>
                  {statusBadge(p.status, t)}
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">{t('payout.amount')}</p>
                    <p className="font-bold text-foreground">
                      ৳{p.amount.toLocaleString('en')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">{t('payout.method')}</p>
                    <p className="font-semibold text-foreground truncate">{p.accountType}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">{t('payout.accountNumber')}</p>
                    <p className="font-semibold text-foreground truncate">{p.accountNumber}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">{t('payout.accountName')}</p>
                    <p className="font-semibold text-foreground truncate">{p.accountName}</p>
                  </div>
                </div>

                {/* Date */}
                <p className="text-[10px] text-muted-foreground/60 text-right">
                  {new Date(p.createdAt).toLocaleDateString('en', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}