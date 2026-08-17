'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useCallback } from 'react';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
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
  Banknote, Clock, CheckCircle, XCircle, ShieldCheck, Wallet, ArrowDownToLine, RefreshCw, Copy,
} from 'lucide-react';

const PARROT_GREEN = '#65A30D';

const GLASS = 'relative rounded-2xl border !border-white/60 !bg-white/40 p-3.5 sm:p-5 shadow-xl !backdrop-blur-xl dark:!border-zinc-800/50 dark:!bg-zinc-900/50 dark:!backdrop-blur-xl';

type Tab = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

function fmtTaka(n: number) { return '৳' + Math.round(n).toLocaleString('en'); }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function methodColor(t: string) {
  const l = t.toLowerCase();
  if (l.includes('bkash')) return '#E2136E';
  if (l.includes('nagad')) return '#F6921E';
  if (l.includes('rocket')) return '#8C3494';
  if (l.includes('bank')) return '#0033A0';
  return '#6B7280';
}

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    approved: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  };
  return (
    <Badge className={`${colors[status] || ''} border-0 font-medium text-[11px]`}>
      {t('adminAffPayout.' + status)}
    </Badge>
  );
}

const MotionTr = motion.tr as any;

export function AdminAffiliatePayoutsPanel() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectDlg, setRejectDlg] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [rejectRsn, setRejectRsn] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-aff-payouts', tab],
    queryFn: async () => {
      const s = tab === 'all' ? '' : tab;
      const r = await fetch(`/api/admin/affiliate/withdrawals${s ? '?status=' + s : ''}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 10_000,
  });

  const wds = data?.withdrawals ?? [];
  const st = data?.stats;
  const pendingCnt = wds.filter((w: any) => w.status === 'pending').length;

  const approve = useCallback(async (id: string) => {
    if (!confirm(t('adminAffPayout.confirmApprove'))) return;
    setLoading(id);
    try {
      const r = await fetch(`/api/admin/affiliate/withdrawals/${id}/approve`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(d.message || t('adminAffPayout.approveSuccess'));
      qc.invalidateQueries({ queryKey: ['admin-aff-payouts'] });
    } catch (e) { toast.error((e as Error).message || t('adminAffPayout.actionFailed')); } finally { setLoading(null); }
  }, [t, qc]);

  const complete = useCallback(async (id: string) => {
    if (!confirm(t('adminAffPayout.confirmComplete'))) return;
    setLoading(id);
    try {
      const r = await fetch(`/api/admin/affiliate/withdrawals/${id}/complete`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(d.message || t('adminAffPayout.completeSuccess'));
      qc.invalidateQueries({ queryKey: ['admin-aff-payouts'] });
    } catch (e) { toast.error((e as Error).message || t('adminAffPayout.actionFailed')); } finally { setLoading(null); }
  }, [t, qc]);

  const reject = useCallback(async () => {
    setLoading(rejectDlg.id);
    try {
      const r = await fetch(`/api/admin/affiliate/withdrawals/${rejectDlg.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectRsn }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(d.message || t('adminAffPayout.rejectSuccess'));
      setRejectDlg({ open: false, id: '', name: '' });
      setRejectRsn('');
      qc.invalidateQueries({ queryKey: ['admin-aff-payouts'] });
    } catch (e) { toast.error((e as Error).message || t('adminAffPayout.actionFailed')); } finally { setLoading(null); }
  }, [rejectDlg, rejectRsn, t, qc]);

  const batchApprove = useCallback(async () => {
    const ids = wds.filter((w: any) => w.status === 'pending').map((w: any) => w.id);
    if (!ids.length || !confirm(t('adminAffPayout.confirmBatch', { count: ids.length }))) return;
    setLoading('batch');
    try {
      const r = await fetch('/api/admin/affiliate/withdrawals/batch-approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(d.message || t('adminAffPayout.batchSuccess'));
      qc.invalidateQueries({ queryKey: ['admin-aff-payouts'] });
    } catch (e) { toast.error((e as Error).message || t('adminAffPayout.actionFailed')); } finally { setLoading(null); }
  }, [wds, t, qc]);

  const clip = (text: string) => { navigator.clipboard.writeText(text); toast.success(t('adminAffPayout.copied')); };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'pending', label: t('adminAffPayout.pending'), count: st?.pendingCount },
    { key: 'approved', label: t('adminAffPayout.approved'), count: st?.approvedCount },
    { key: 'completed', label: t('adminAffPayout.completed'), count: st?.completedCount },
    { key: 'rejected', label: t('adminAffPayout.rejected'), count: st?.rejectedCount },
    { key: 'all', label: t('adminAffPayout.all') },
  ];
  const aIdx = tabs.findIndex((x) => x.key === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl" style={{ backgroundColor: PARROT_GREEN }}>
              <Banknote className="h-5 w-5 text-white" />
            </div>
            {t('adminAffPayout.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('adminAffPayout.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> {t('adminAffPayout.refresh')}
          </Button>
          {pendingCnt > 0 && (
            <Button size="sm" className="gap-1.5 h-9" style={{ backgroundColor: PARROT_GREEN, color: '#fff' }} disabled={!!loading} onClick={batchApprove}>
              {loading === 'batch' ? <LoadingAnimation size="sm" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {t('adminAffPayout.batchApprove', { count: pendingCnt })}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t('adminAffPayout.pendingAmount'), value: st ? fmtTaka(st.pendingAmount) : '৳0', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: t('adminAffPayout.pendingCount'), value: String(st?.pendingCount ?? 0), icon: ArrowDownToLine, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: t('adminAffPayout.completedAmount'), value: st ? fmtTaka(st.completedAmount) : '৳0', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: t('adminAffPayout.totalProcessed'), value: String((st?.approvedCount ?? 0) + (st?.completedCount ?? 0) + (st?.rejectedCount ?? 0)), icon: Wallet, color: 'text-primary', bg: 'bg-primary/10' },
        ].map((s, i) => {
          const Ic = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className={GLASS}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
                    <p className={'mt-1 text-xl sm:text-2xl font-bold tracking-tight ' + s.color}>{s.value}</p>
                  </div>
                  <div className={'flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ' + s.bg}>
                    <Ic className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tb, idx) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={'relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-all ' + (idx === aIdx ? 'text-white shadow-lg' : 'text-muted-foreground hover:bg-accent hover:text-foreground')} style={idx === aIdx ? { backgroundColor: PARROT_GREEN, boxShadow: '0 4px 14px ' + PARROT_GREEN + '40' } : undefined}>
            {tb.label}
            {tb.count !== undefined && tb.count > 0 && (
              <span className={'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ' + (idx === aIdx ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={GLASS + ' !p-0 overflow-hidden'}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><LoadingAnimation size="lg" /></div>
        ) : wds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4"><Wallet className="h-8 w-8 text-muted-foreground/40" /></div>
            <p className="text-sm font-medium text-muted-foreground">{t('adminAffPayout.noWithdrawals')}</p>
            <p className="mt-1 text-xs text-muted-foreground/60">{t('adminAffPayout.noWithdrawalsDesc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border/50 bg-muted/80 backdrop-blur-sm">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('adminAffPayout.user')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('adminAffPayout.amount')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('adminAffPayout.method')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('adminAffPayout.account')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('adminAffPayout.status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('adminAffPayout.date')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('adminAffPayout.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {wds.map((w: any) => (
                  <MotionTr key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border/20 transition-colors hover:bg-accent/20 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: PARROT_GREEN }}>{(w.user?.name || '?').charAt(0)}</div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[120px]">{w.user?.name || '-'}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{w.user?.email || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right"><span className="font-bold text-foreground">{fmtTaka(w.amount)}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: methodColor(w.accountType) }} />
                        <span className="text-xs font-medium text-foreground">{w.accountType}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-foreground font-medium flex items-center gap-1">{w.accountNumber}<button onClick={() => clip(w.accountNumber)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"><Copy className="h-3 w-3" /></button></p>
                        <p className="text-[11px] text-muted-foreground">{w.accountName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={w.status} t={t} /></td>
                    <td className="px-4 py-3"><span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(w.createdAt)}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {w.status === 'pending' && (<>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" disabled={!!loading} onClick={() => approve(w.id)} title={t('adminAffPayout.approve')}>
                            {loading === w.id ? <LoadingAnimation size="sm" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" disabled={!!loading} onClick={() => setRejectDlg({ open: true, id: w.id, name: w.user?.name || '' })} title={t('adminAffPayout.reject')}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>)}
                        {w.status === 'approved' && (<Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-500/10" disabled={!!loading} onClick={() => complete(w.id)} title={t('adminAffPayout.complete')}>
                          {loading === w.id ? <LoadingAnimation size="sm" /> : <ShieldCheck className="h-4 w-4" />}
                        </Button>)}
                        {w.status === 'rejected' && w.note && <span className="text-[10px] text-muted-foreground max-w-[80px] truncate" title={w.note}>{w.note}</span>}
                        {w.status === 'completed' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                      </div>
                    </td>
                  </MotionTr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={rejectDlg.open} onOpenChange={(o) => !o && setRejectDlg({ open: false, id: '', name: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" />{t('adminAffPayout.rejectTitle')}</DialogTitle>
            <DialogDescription>{t('adminAffPayout.rejectDesc', { name: rejectDlg.name })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-xs font-medium text-muted-foreground">{t('adminAffPayout.rejectReason')}</label>
            <Textarea value={rejectRsn} onChange={(e) => setRejectRsn(e.target.value)} placeholder={t('adminAffPayout.rejectReasonPlaceholder')} rows={3} className="resize-none" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectDlg({ open: false, id: '', name: '' })} disabled={!!loading}>{t('adminAffPayout.cancel')}</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={!!loading} onClick={reject}>
              {loading === rejectDlg.id ? <LoadingAnimation size="sm" /> : <XCircle className="h-4 w-4" />}{t('adminAffPayout.confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
