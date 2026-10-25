'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT, type TranslationKey } from '@/lib/i18n';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Flag, Search, Loader2, Store, Package, Star, X, CheckCircle2,
  PlayCircle, XCircle, History, ShieldAlert, ArrowRight,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — Reports & Moderation panel (centralized).
   Reported SELLERS and PRODUCTS live here; reported REVIEWS keep
   their dedicated review-moderation panel (open count is surfaced
   so this stays the single monitoring entry point).
   Statuses: pending → under_review → resolved | rejected.
   Resolving can execute the linked action (unpublish/remove/restore
   a product, suspend/restrict a seller) through the same shared
   helpers the other panels use.
   ═══════════════════════════════════════════════════════════════ */

interface ReportRow {
  id: string; targetType: string; targetId: string;
  targetLabel: string; targetMeta: string | null;
  reporterId: string | null; reporterName: string | null;
  reason: string; details: string | null;
  status: string; resolution: string | null; adminNote: string | null;
  decidedById: string | null; decidedByName: string | null; decidedAt: string | null;
  createdAt: string;
}

type TypeFilter = 'all' | 'seller' | 'product';
type StatusFilter = 'all' | 'pending' | 'under_review' | 'resolved' | 'rejected';
type DecideMode = 'resolve' | 'reject' | null;

export function AdminModerationReportsPanel() {
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [q, setQ] = useState('');

  const [decideMode, setDecideMode] = useState<DecideMode>(null);
  const [decideReport, setDecideReport] = useState<ReportRow | null>(null);
  const [resolution, setResolution] = useState<string>('no_action');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ targetType: typeFilter, status: statusFilter, q });
      const res = await fetch(`/api/admin/moderation-reports?${params}`);
      const json = await res.json();
      if (res.ok) {
        setReports(json.reports || []);
        setStats(json.stats || {});
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, q, t]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, q ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const startReview = async (r: ReportRow) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/moderation-reports/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_review' }),
      });
      const json = await res.json();
      if (res.ok) { toast.success(json.message); load(); }
      else toast.error(json.error || t('common.error'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async () => {
    if (!decideReport || !decideMode) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/moderation-reports/${decideReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          decideMode === 'resolve'
            ? { action: 'resolve', resolution, note: note.trim() }
            : { action: 'reject', note: note.trim() },
        ),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message);
        setDecideMode(null);
        setDecideReport(null);
        setNote('');
        load();
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const chips = (options: { value: string; label: string }[], current: string, set: (v: never) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value as never)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            current === o.value
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
      under_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
      resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
      rejected: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-400',
    };
    const labels: Record<string, string> = {
      pending: 'adminMkt.rsPending', under_review: 'adminMkt.rsUnderReview',
      resolved: 'adminMkt.rsResolved', rejected: 'adminMkt.rsRejected',
    };
    return <Badge className={`border-0 text-[10px] ${map[s] || map.pending}`}>{t((labels[s] || 'adminMkt.rsPending') as TranslationKey)}</Badge>;
  };

  const resolutionOptions = (targetType: string) =>
    targetType === 'product'
      ? [
          { value: 'no_action', label: t('adminMkt.resNoAction') },
          { value: 'product_unpublished', label: t('adminMkt.resUnpublish') },
          { value: 'product_removed', label: t('adminMkt.resRemove') },
          { value: 'product_restored', label: t('adminMkt.resRestore') },
        ]
      : [
          { value: 'no_action', label: t('adminMkt.resNoAction') },
          { value: 'seller_suspended', label: t('adminMkt.resSuspend') },
          { value: 'seller_restricted', label: t('adminMkt.resRestrict') },
        ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{t('adminMkt.reportsTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('adminMkt.reportsDesc')}</p>
      </div>

      {/* Stats chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Flag, label: t('adminMkt.rsPending'), value: stats.pending || 0, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
          { icon: PlayCircle, label: t('adminMkt.rsUnderReview'), value: stats.underReview || 0, cls: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400' },
          { icon: CheckCircle2, label: t('adminMkt.rsResolved'), value: stats.resolved || 0, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
          { icon: Star, label: t('adminMkt.statOpenReviewReports'), value: stats.openReviewReports || 0, cls: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/60 p-3.5">
            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.cls}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground tabular-nums">{s.value}</p>
            <p className="text-[11px] font-medium text-muted-foreground leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('adminMkt.searchReports')} className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {chips([
            { value: 'all', label: t('adminMkt.filterAll') },
            { value: 'seller', label: t('adminMkt.typeSellers') },
            { value: 'product', label: t('adminMkt.typeProducts') },
          ], typeFilter, setTypeFilter)}
          {chips([
            { value: 'all', label: t('adminMkt.filterAll') },
            { value: 'pending', label: t('adminMkt.rsPending') },
            { value: 'under_review', label: t('adminMkt.rsUnderReview') },
            { value: 'resolved', label: t('adminMkt.rsResolved') },
            { value: 'rejected', label: t('adminMkt.rsRejected') },
          ], statusFilter, setStatusFilter)}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-6 text-center">{t('adminMkt.noReportsFound')}</p>
      ) : (
        <div className="space-y-2.5">
          {reports.map((r) => {
            const meta = (() => { try { return r.targetMeta ? JSON.parse(r.targetMeta) : {}; } catch { return {}; } })();
            const open = r.status === 'pending' || r.status === 'under_review';
            return (
              <div key={r.id} className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/60 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      r.targetType === 'seller'
                        ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400'
                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                    }`}
                  >
                    {r.targetType === 'seller' ? <Store className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{r.targetLabel}</p>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.targetType === 'seller' ? t('adminMkt.typeSellers') : t('adminMkt.typeProducts')}
                      {meta.sellerName ? ` · ${meta.sellerName}` : ''}
                      {meta.productStatus ? ` · ${t('adminMkt.statusWas')}: ${meta.productStatus}` : ''}
                      {' · '}{t('adminMkt.reportedBy')}: {r.reporterName || '—'}
                      {' · '}{fmtDate(r.createdAt)}
                    </p>
                    <p className="text-xs text-foreground mt-1.5">{r.reason}</p>
                    {r.details && <p className="text-[11px] text-muted-foreground mt-0.5">{r.details}</p>}

                    {/* Decision record */}
                    {!open && (
                      <div className="mt-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-2 space-y-0.5">
                        <p className="text-[11px] text-foreground">
                          <span className="font-medium">{t('adminMkt.resolution')}:</span> {r.resolution || '—'}
                        </p>
                        {r.adminNote && <p className="text-[11px] text-muted-foreground">{r.adminNote}</p>}
                        <p className="text-[10px] text-muted-foreground/70">
                          {r.decidedByName || '—'} · {fmtDate(r.decidedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {open && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-border/40">
                    {r.status === 'pending' && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => startReview(r)} className="h-7 text-xs">
                        <PlayCircle className="h-3.5 w-3.5 mr-1" />{t('adminMkt.startReview')}
                      </Button>
                    )}
                    <Button size="sm" disabled={busy}
                      onClick={() => { setDecideMode('resolve'); setDecideReport(r); setResolution('no_action'); setNote(''); }}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t('adminMkt.resolve')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => { setDecideMode('reject'); setDecideReport(r); setNote(''); }}
                      className="h-7 text-xs text-zinc-600">
                      <XCircle className="h-3.5 w-3.5 mr-1" />{t('adminMkt.rejectReport')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decision dialog */}
      <Dialog open={!!decideMode && !!decideReport} onOpenChange={(v) => { if (!v) { setDecideMode(null); setDecideReport(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {decideMode === 'resolve' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-zinc-500" />}
              {decideReport?.targetLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {decideMode === 'resolve' && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('adminMkt.chooseResolution')} *</Label>
                <div className="space-y-1.5">
                  {resolutionOptions(decideReport?.targetType || 'product').map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setResolution(o.value)}
                      className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        resolution === o.value
                          ? 'border-primary/40 bg-primary/5 text-primary'
                          : 'border-border/60 text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {o.label}
                      {resolution === o.value && <ArrowRight className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
                {resolution !== 'no_action' && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5 pt-1">
                    <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
                    {t('adminMkt.resolutionExecutesHint')}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  {decideMode === 'reject' || resolution !== 'no_action' ? t('adminMkt.reasonRequired') : t('adminMkt.noteOptional')}
                  {decideMode === 'reject' || resolution !== 'no_action' ? ' *' : ''}
                </Label>
                <button onClick={() => { setDecideMode(null); setDecideReport(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t('adminMkt.reasonPlaceholder')}
              />
            </div>
            <Button className="w-full" disabled={busy || !note.trim()} onClick={submitDecision}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {decideMode === 'resolve' ? t('adminMkt.confirmResolve') : t('adminMkt.confirmReject')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
