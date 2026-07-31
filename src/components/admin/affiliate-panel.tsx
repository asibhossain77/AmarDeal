'use client';

import { useState, useCallback } from 'react';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users, Wallet, Clock, TrendingUp, Save, Loader2, Copy,
  CheckCircle, XCircle, Banknote, Inbox, AlertTriangle, ShieldCheck, CircleCheck,
} from 'lucide-react';

/* ═══ Constants ═══ */

const PARROT_GREEN = '#65A30D';
const PARROT_GREEN_GLOW = '0 4px 16px rgba(101, 163, 13, 0.30)';

const GLASS_CARD =
  'relative rounded-2xl border !border-white/60 !bg-white/40 p-3.5 sm:p-5 shadow-xl !backdrop-blur-xl dark:!border-zinc-800/50 dark:!bg-zinc-900/50 dark:!backdrop-blur-xl';

type WithdrawTab = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

/* ═══ Helpers ═══ */

function formatTaka(amount: number): string {
  return '\u09F3' + Math.round(amount).toLocaleString('en');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getAccountTypeLabel(type: string): string {
  switch (type) {
    case 'bkash': return 'bKash';
    case 'nagad': return 'Nagad';
    case 'rocket': return 'Rocket';
    case 'bank': return 'Bank';
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

/* ═══ Component ═══ */

export function AdminAffiliatePanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const [withdrawTab, setWithdrawTab] = useState<WithdrawTab>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [rejectReason, setRejectReason] = useState('');

  /* ── Fetch affiliate overview ── */
  const { data: overview } = useQuery({
    queryKey: ['admin-affiliate-overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/affiliate');
      if (!res.ok) throw new Error();
      return res.json();
    },
    staleTime: 15_000,
  });

  /* ── Fetch withdrawals ── */
  const { data: wdData, isLoading: wdLoading } = useQuery({
    queryKey: ['admin-affiliate-withdrawals', withdrawTab],
    queryFn: async () => {
      const status = withdrawTab === 'all' ? '' : withdrawTab;
      const res = await fetch(`/api/admin/affiliate/withdrawals${status ? `?status=${status}` : ''}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    staleTime: 10_000,
  });

  const stats = overview?.stats;
  const topAffiliates = overview?.topAffiliates ?? [];
  const recentEarnings = overview?.recentEarnings ?? [];
  const commissionPercent = overview?.commissionPercent ?? 30;
  const withdrawals = wdData?.withdrawals ?? [];
  const wdStats = wdData?.stats;
  const [savingPercent, setSavingPercent] = useState(false);

  /* ── Actions ── */
  const handleApprove = useCallback(async (id: string) => {
    if (!confirm(t('adminAff.confirmApprove'))) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/affiliate/withdrawals/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || t('adminAff.approveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-overview'] });
    } catch (err) {
      toast.error((err as Error).message || t('adminAff.actionFailed'));
    } finally {
      setActionLoading(null);
    }
  }, [t, queryClient]);

  const handleReject = useCallback(async () => {
    setActionLoading(rejectDialog.id);
    try {
      const res = await fetch(`/api/admin/affiliate/withdrawals/${rejectDialog.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || t('adminAff.rejectSuccess'));
      setRejectDialog({ open: false, id: '', name: '' });
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-overview'] });
    } catch (err) {
      toast.error((err as Error).message || t('adminAff.actionFailed'));
    } finally {
      setActionLoading(null);
    }
  }, [rejectDialog, rejectReason, t, queryClient]);

  const handleComplete = useCallback(async (id: string) => {
    if (!confirm(t('adminAff.confirmComplete'))) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/affiliate/withdrawals/${id}/complete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || t('adminAff.completeSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-overview'] });
    } catch (err) {
      toast.error((err as Error).message || t('adminAff.actionFailed'));
    } finally {
      setActionLoading(null);
    }
  }, [t, queryClient]);

  const handleBatchApprove = useCallback(async () => {
    const pendingIds = withdrawals.filter((w: any) => w.status === 'pending').map((w: any) => w.id);
    if (pendingIds.length === 0) return;
    if (!confirm(t('adminAff.confirmBatch'))) return;
    setActionLoading('batch');
    try {
      const res = await fetch('/api/admin/affiliate/withdrawals/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || t('adminAff.batchSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-overview'] });
    } catch (err) {
      toast.error((err as Error).message || t('adminAff.actionFailed'));
    } finally {
      setActionLoading(null);
    }
  }, [withdrawals, t, queryClient]);

  const handleSavePercent = async () => {
    setSavingPercent(true);
    try {
      const res = await fetch('/api/admin/affiliate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionPercent: Number(commissionPercent) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
    } catch (err) {
      toast.error((err as Error).message || 'Error');
    }
    setSavingPercent(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('affiliate.copied'));
  };

  /* ── Tab config ── */
  const TABS: { key: WithdrawTab; label: string; count?: number }[] = [
    { key: 'all', label: t('adminAff.all') },
    { key: 'pending', label: t('adminAff.pending'), count: wdStats?.pendingCount },
    { key: 'approved', label: t('adminAff.approved'), count: wdStats?.approvedCount },
    { key: 'rejected', label: t('adminAff.rejected'), count: wdStats?.rejectedCount },
    { key: 'completed', label: t('adminAff.completed'), count: wdStats?.completedCount },
  ];

  const activeTabIdx = TABS.findIndex((tb) => tb.key === withdrawTab);
  const pendingWdCount = withdrawals.filter((w: any) => w.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl" style={{ backgroundColor: PARROT_GREEN }}>
              <Users className="h-5 w-5 text-white" />
            </div>
            {t('adminNav.affiliate')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('adminAff.affiliateSystemMgmt')}</p>
        </div>
      </div>

      {/* ═══════ Overview Stats ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t('adminAff.activeAffiliates'), value: stats?.activeAffiliates?.toLocaleString('en') ?? '0', icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: t('adminAff.totalDistributed'), value: stats ? formatTaka(stats.totalEarningsDistributed) : '\u09F30', icon: Wallet, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: t('adminAff.pendingAmount'), value: wdStats ? formatTaka(wdStats.pendingAmount) : '\u09F30', icon: Clock, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
          { label: t('adminAff.completedAmount'), value: wdStats ? formatTaka(wdStats.completedAmount) : '\u09F30', icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-600/10' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }} className={GLASS_CARD}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg sm:text-xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ═══════ Commission Setting ═══════ */}
      <div className={GLASS_CARD}>
        <h3 className="text-base font-semibold text-foreground mb-3">{t('adminAff.commissionSetting')}</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">{t('adminAff.commissionPct')}</Label>
            <Input type="number" min={1} max={100} value={commissionPercent} onChange={() => {}} className="h-10" disabled={savingPercent} />
          </div>
          <Button onClick={handleSavePercent} disabled={savingPercent} className="h-10 gap-1.5" style={{ backgroundColor: PARROT_GREEN }}>
            {savingPercent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('adminAff.save')}
          </Button>
        </div>
      </div>

      {/* ═══════ WITHDRAWAL MANAGEMENT ═══════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(101, 163, 13, 0.12)' }}>
              <Banknote className="h-4 w-4" style={{ color: PARROT_GREEN }} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('adminAff.withdrawalMgmt')}</h3>
              <p className="text-xs text-muted-foreground">{t('adminAff.withdrawalMgmtDesc')}</p>
            </div>
          </div>
          {withdrawTab === 'pending' && pendingWdCount > 0 && (
            <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold text-white rounded-lg" style={{ backgroundColor: PARROT_GREEN }} onClick={handleBatchApprove} disabled={actionLoading === 'batch'}>
              {actionLoading === 'batch' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              {t('adminAff.batchApprove')}
            </Button>
          )}
        </div>

        {withdrawTab === 'approved' && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">{t('adminAff.approvedInfo')}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="relative flex items-center gap-1 p-1 rounded-xl w-fit overflow-x-auto" style={{ backgroundColor: 'var(--muted)' }}>
          <motion.div className="absolute top-1 bottom-1 rounded-lg" style={{ backgroundColor: PARROT_GREEN, boxShadow: PARROT_GREEN_GLOW }} animate={{ x: `${activeTabIdx * 100}%` }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setWithdrawTab(tab.key)} className="relative z-10 px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap" style={{ color: withdrawTab === tab.key ? '#fff' : 'var(--muted-foreground)' }}>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: withdrawTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--muted-foreground)', color: '#fff' }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Withdrawal List */}
        {wdLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={GLASS_CARD}><div className="flex items-center justify-between gap-3"><div className="flex-1 space-y-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /><div className="h-3 w-48 animate-pulse rounded bg-muted" /></div><div className="space-y-2"><div className="h-5 w-20 animate-pulse rounded bg-muted ml-auto" /><div className="h-8 w-28 animate-pulse rounded-lg bg-muted ml-auto" /></div></div></div>
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <div className={`${GLASS_CARD} flex flex-col items-center justify-center py-16`}>
            <Inbox className="h-14 w-14 text-muted-foreground/25 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">{t('adminAff.noWithdrawals')}</p>
            <p className="mt-1 text-xs text-muted-foreground/60">{t('adminAff.noWithdrawalsDesc')}</p>
          </div>
        ) : (
          <div className="wd-scroll space-y-3 max-h-[480px] overflow-y-auto pr-1">
            <style>{`.wd-scroll::-webkit-scrollbar{width:5px}.wd-scroll::-webkit-scrollbar-track{background:transparent}.wd-scroll::-webkit-scrollbar-thumb{background:${PARROT_GREEN}40;border-radius:9999px}.wd-scroll::-webkit-scrollbar-thumb:hover{background:${PARROT_GREEN}60}`}</style>
            <AnimatePresence mode="popLayout">
              {withdrawals.map((w: any, idx: number) => (
                <motion.div key={w.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, delay: idx * 0.03 }} className={GLASS_CARD}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={w.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium text-[11px]' : w.status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium text-[11px]' : w.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium text-[11px]' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium text-[11px]'}>
                          {w.status === 'pending' ? t('adminAff.pendingBadge') : w.status === 'approved' ? t('adminAff.approvedBadge') : w.status === 'rejected' ? t('adminAff.rejectedBadge') : t('adminAff.completedBadge')}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">#{w.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{w.user?.name || '---'}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{w.user?.phone || ''}</span>
                        {w.user?.email && <><span>·</span><span className="truncate max-w-[140px]">{w.user.email}</span></>}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold" style={{ color: getAccountTypeColor(w.accountType) }}>{getAccountTypeLabel(w.accountType)}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono text-foreground/80">{w.accountNumber}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-foreground/80">{w.accountName}</span>
                      </div>
                      {w.note && <p className="text-[11px] text-muted-foreground/70 italic">{t('adminAff.note')}: {w.note}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-1.5">
                      <p className="text-lg font-bold text-foreground">{formatTaka(w.amount)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(w.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/30">
                    {w.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10 rounded-lg" onClick={() => setRejectDialog({ open: true, id: w.id, name: w.user?.name || '' })} disabled={actionLoading === w.id}>
                          {actionLoading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          {t('adminAff.reject')}
                        </Button>
                        <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold text-white rounded-lg" style={{ backgroundColor: PARROT_GREEN }} onClick={() => handleApprove(w.id)} disabled={actionLoading === w.id}>
                          {actionLoading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          {t('adminAff.approve')}
                        </Button>
                      </>
                    )}
                    {w.status === 'approved' && (
                      <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold text-white rounded-lg" style={{ backgroundColor: PARROT_GREEN }} onClick={() => handleComplete(w.id)} disabled={actionLoading === w.id}>
                        {actionLoading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
                        {t('adminAff.markPaid')}
                      </Button>
                    )}
                    {w.status === 'rejected' && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-400" /> {t('adminAff.rejectedLabel')}
                      </span>
                    )}
                    {w.status === 'completed' && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> {t('adminAff.paidLabel')}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ═══════ Top Affiliates ═══════ */}
      <div className={GLASS_CARD}>
        <h3 className="text-base font-semibold text-foreground mb-3">{t('adminAff.topAffiliates')}</h3>
        {topAffiliates.length > 0 ? (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border/50 bg-muted/80">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{t('adminAff.name')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{t('adminAff.code')}</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">{t('adminAff.referrals')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{t('adminAff.earnings')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{t('adminAff.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {topAffiliates.map((a: any) => (
                  <tr key={a.id} className="border-b border-border/30 hover:bg-accent/30 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground text-xs">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.referralCode ? (
                        <button onClick={() => handleCopyCode(a.referralCode)} className="flex items-center gap-1 text-xs font-mono text-primary hover:underline">
                          <Copy className="h-3 w-3" /> {a.referralCode}
                        </button>
                      ) : <span className="text-xs text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">{a._count.referredUsers}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatTaka(a._count.affiliateEarnings)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold">{formatTaka(a.affiliateBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('adminAff.noAffiliatesYet')}</p>
        )}
      </div>

      {/* ═══════ Recent Commissions ═══════ */}
      <div className={GLASS_CARD}>
        <h3 className="text-base font-semibold text-foreground mb-3">{t('adminAff.recentCommissions')}</h3>
        {recentEarnings.length > 0 ? (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border/50 bg-muted/80">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{t('adminAff.affiliate')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{t('adminAff.referred')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{t('adminAff.deal')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{t('adminAff.amount')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{t('adminAff.date')}</th>
                </tr>
              </thead>
              <tbody>
                {recentEarnings.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/30 hover:bg-accent/30 last:border-0">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">{e.affiliate?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.referredUser?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">{e.deal?.title || '-'}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{formatTaka(e.amount)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('adminAff.noCommissionsYet')}</p>
        )}
      </div>

      {/* ═══════ Reject Dialog ═══════ */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => { if (!open) { setRejectDialog({ open: false, id: '', name: '' }); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {t('adminAff.reject')}
            </DialogTitle>
            <DialogDescription>
              {t('adminAff.confirmReject')}
              {rejectDialog.name && <span className="block mt-1 font-semibold text-foreground">{rejectDialog.name}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs text-muted-foreground">{t('adminAff.rejectReason')}</Label>
            <Textarea placeholder={t('adminAff.rejectReasonPlaceholder')} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="resize-none" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false, id: '', name: '' }); setRejectReason(''); }} className="flex-1" disabled={!!actionLoading}>
              {t('affiliate.cancel')}
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {t('adminAff.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
