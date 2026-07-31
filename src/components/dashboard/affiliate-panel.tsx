'use client';

import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Check,
  Users,
  Wallet,
  TrendingUp,
  Clock,
  Link2,
  ArrowDownToLine,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useT } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const emptySubscribe = () => () => {};

/* ═══ Types ═══ */

interface AffiliateData {
  referralCode: string | null;
  referralLink: string | null;
  affiliateBalance: number;
  referredCount: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  commissionPercent: number;
  earnings: AffiliateEarning[];
}

interface AffiliateEarning {
  id: string;
  amount: number;
  percentage: number;
  status: string;
  createdAt: string;
  deal: { id: string; title: string; amount: number } | null;
  referredUser: { id: string; name: string } | null;
}

/* ═══ Helpers ═══ */

function formatTaka(amount: number): string {
  return '৳' + Math.round(amount).toLocaleString('en');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-2xl border !border-white/60 !bg-white/40 p-3.5 sm:p-5 shadow-xl !backdrop-blur-xl dark:!border-zinc-800/50 dark:!bg-zinc-900/50 dark:!backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

/* ═══ Main Component ═══ */

export function AffiliatePanel() {
  const user = useAppStore((s) => s.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', accountType: 'bkash', accountNumber: '', accountName: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data, isLoading, error, refetch } = useQuery<AffiliateData>({
    queryKey: ['user-affiliate', userId],
    queryFn: async () => {
      const res = await fetch('/api/user/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to fetch affiliate data');
      return res.json();
    },
    enabled: !!userId,
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(t('affiliate.copied'));
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error(t('affiliate.copyFailed'));
    });
  };

  const handleWithdraw = async () => {
    const numAmount = Number(withdrawForm.amount);
    if (!numAmount || numAmount < 100 || !withdrawForm.accountNumber || !withdrawForm.accountName) {
      toast.error(t('affiliate.fillAllFields'));
      return;
    }
    if (numAmount > (data?.affiliateBalance ?? 0)) {
      toast.error(t('affiliate.insufficientBalance'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdrawForm),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      toast.success(result.message || t('affiliate.withdrawSuccess'));
      setShowWithdraw(false);
      setWithdrawForm({ amount: '', accountType: 'bkash', accountNumber: '', accountName: '' });
      queryClient.invalidateQueries({ queryKey: ['user-affiliate', userId] });
    } catch (err: any) {
      toast.error(err.message || t('affiliate.withdrawFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t('affiliate.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('affiliate.subtitle')}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i}>
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-14 sm:w-20 animate-pulse rounded bg-muted" />
                  <div className="h-6 sm:h-7 w-12 sm:w-16 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-10 w-10 sm:h-11 sm:w-11 animate-pulse rounded-xl bg-muted" />
              </div>
            </GlassCard>
          ))}
        </div>
      ) : data ? (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <GlassCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('affiliate.totalEarnings')}</p>
                    <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {formatTaka(data.totalEarnings)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <GlassCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('affiliate.availableBalance')}</p>
                    <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {formatTaka(data.affiliateBalance)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <GlassCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('affiliate.pendingPayout')}</p>
                    <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {formatTaka(data.pendingEarnings)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 dark:text-amber-400" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <GlassCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('affiliate.totalReferrals')}</p>
                    <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {data.referredCount.toLocaleString('en')}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* ── Referral Link Card ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <GlassCard>
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground">{t('affiliate.referralLink')}</h3>
              </div>
              {data.referralCode && data.referralLink ? (
                <div className="space-y-3">
                  {/* Referral Code Display */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{t('affiliate.yourCode')}:</span>
                    <code className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-sm font-mono font-semibold text-foreground">
                      {data.referralCode}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-9 gap-1.5"
                      onClick={() => handleCopy(data.referralCode!)}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{t('affiliate.copyCode')}</span>
                    </Button>
                  </div>
                  {/* Referral Link Display */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">Link:</span>
                    <code className="flex-1 min-w-0 rounded-lg bg-muted/50 px-3 py-2 text-xs font-mono text-foreground truncate">
                      {data.referralLink}
                    </code>
                    <Button
                      size="sm"
                      className="shrink-0 h-9 gap-1.5"
                      onClick={() => handleCopy(data.referralLink!)}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{t('affiliate.copyLink')}</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('affiliate.commissionInfo', { percent: data.commissionPercent })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('affiliate.noCode')}</p>
              )}
            </GlassCard>
          </motion.div>

          {/* ── Earnings History ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <GlassCard className="!p-0 overflow-hidden">
              <div className="p-5 pb-3">
                <h3 className="text-base font-semibold text-foreground">{t('affiliate.earningsHistory')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('affiliate.earningsHistoryDesc')}
                </p>
              </div>

              {data.earnings.length > 0 ? (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-t border-b border-border/50 bg-muted/80 backdrop-blur-sm">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {t('affiliate.userCol')}
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {t('affiliate.dealCol')}
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {t('affiliate.amountCol')}
                        </th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {t('affiliate.statusCol')}
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {t('affiliate.dateCol')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.earnings.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-border/30 transition-colors hover:bg-accent/30 last:border-0"
                        >
                          <td className="px-5 py-3 font-medium text-foreground max-w-[120px] truncate">
                            {e.referredUser?.name || '-'}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground max-w-[150px] truncate">
                            {e.deal?.title || '-'}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            +{formatTaka(e.amount)}
                          </td>
                          <td className="px-5 py-3 text-center whitespace-nowrap">
                            <Badge
                              className={
                                e.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium'
                              }
                            >
                              {e.status === 'paid' ? t('affiliate.paid') : t('affiliate.pending')}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right text-muted-foreground whitespace-nowrap text-xs">
                            {formatDate(e.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">{t('affiliate.noEarnings')}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">{t('affiliate.noEarningsDesc')}</p>
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* ── Withdrawal Section ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">{t('affiliate.withdrawTitle')}</h3>
                </div>
                {!showWithdraw && data.affiliateBalance >= 100 && (
                  <Button size="sm" className="gap-1.5 h-9" onClick={() => setShowWithdraw(true)}>
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    {t('affiliate.withdrawBtn')}
                  </Button>
                )}
              </div>

              {data.affiliateBalance < 100 ? (
                <p className="text-sm text-muted-foreground">{t('affiliate.minWithdrawInfo', { min: '100' })}</p>
              ) : showWithdraw ? (
                <div className="space-y-4">
                  {/* Balance display */}
                  <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('affiliate.availableBalance')}</span>
                    <span className="text-lg font-bold text-foreground">{formatTaka(data.affiliateBalance)}</span>
                  </div>

                  {/* Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('affiliate.amountLabel')} (৳)</Label>
                      <Input
                        type="number"
                        placeholder="100"
                        min={100}
                        max={data.affiliateBalance}
                        value={withdrawForm.amount}
                        onChange={(e) => setWithdrawForm((p) => ({ ...p, amount: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('affiliate.accountTypeLabel')}</Label>
                      <select
                        value={withdrawForm.accountType}
                        onChange={(e) => setWithdrawForm((p) => ({ ...p, accountType: e.target.value }))}
                        className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="rocket">Rocket</option>
                        <option value="bank">Bank</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('affiliate.accountNumberLabel')}</Label>
                      <Input
                        placeholder="01XXXXXXXXX"
                        value={withdrawForm.accountNumber}
                        onChange={(e) => setWithdrawForm((p) => ({ ...p, accountNumber: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('affiliate.accountNameLabel')}</Label>
                      <Input
                        placeholder={t('affiliate.accountNamePlaceholder')}
                        value={withdrawForm.accountName}
                        onChange={(e) => setWithdrawForm((p) => ({ ...p, accountName: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={handleWithdraw}
                      disabled={isSubmitting}
                      className="flex-1 h-11 gap-2 font-semibold"
                    >
                      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('affiliate.submitWithdraw')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowWithdraw(false)}
                      className="h-11 gap-1.5"
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                      {t('affiliate.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('affiliate.withdrawInfo')}</p>
              )}
            </GlassCard>
          </motion.div>
        </>
      ) : error ? (
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive/60 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{t('affiliate.loadError')}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('affiliate.retry')}
          </Button>
        </GlassCard>
      ) : null}
    </motion.div>
  );
}
