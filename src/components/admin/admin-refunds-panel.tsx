'use client';

/**
 * Admin Refunds Panel — Phase 6 refund management.
 *
 * Dedicated section for reviewing buyer refund requests:
 * under_review → request info → approve → start processing →
 * mark_refunded (verified manual refund reference REQUIRED).
 * Rejections need a reason. Every action is audited server-side.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw, Search, Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { EvidenceChips } from '@/components/shared/order-protection';

interface RefundRow {
  id: string;
  orderId: string;
  reason: string;
  evidence: string | null;
  amount: number;
  status: string;
  adminNote: string | null;
  infoRequest: string | null;
  refundMethod: string | null;
  refundReference: string | null;
  refundedAt: string | null;
  createdAt: string;
  order: {
    id: string; orderNumber: string; serviceName: string; status: string;
    paymentStatus: string; totalAmount: number;
    user: { id: string; name: string; email: string; phone: string };
    seller: { id: string; name: string } | null;
    product: { itemType: string } | null;
  };
}

interface RefundsResponse {
  requests: RefundRow[];
  stats: {
    requestedCount: number; underReviewCount: number; approvedCount: number;
    rejectedCount: number; processingCount: number; refundedCount: number;
    refundedAmount: number; pendingAmount: number;
  };
}

const STATUSES = ['all', 'requested', 'under_review', 'approved', 'processing', 'refunded', 'rejected'] as const;

function StatusChip({ status }: { status: string }) {
  const t = useT();
  const cls: Record<string, string> = {
    requested: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    under_review: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    processing: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    refunded: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cls[status] ?? 'bg-muted text-muted-foreground')}>
      {t(`prot.refundStatus.${status}` as TranslationKey)}
    </span>
  );
}

export function AdminRefundsPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<RefundRow | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ status });
    if (q) p.set('q', q);
    return p.toString();
  }, [status, q]);

  const { data, isLoading, isFetching, refetch } = useQuery<RefundsResponse>({
    queryKey: ['admin-refunds', params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/refunds?${params}`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const rows = data?.requests ?? [];
  const stats = data?.stats;

  const statChips = stats ? [
    { key: 'requested', label: t('prot.refundStatus.requested'), value: stats.requestedCount },
    { key: 'under_review', label: t('prot.refundStatus.under_review'), value: stats.underReviewCount },
    { key: 'approved', label: t('prot.refundStatus.approved'), value: stats.approvedCount },
    { key: 'processing', label: t('prot.refundStatus.processing'), value: stats.processingCount },
    { key: 'refunded', label: t('prot.refundStatus.refunded'), value: stats.refundedCount, extra: `৳${stats.refundedAmount.toLocaleString('en')}` },
    { key: 'rejected', label: t('prot.refundStatus.rejected'), value: stats.rejectedCount },
  ] : [];

  const onAction = async (payload: Record<string, unknown>) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/refunds/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t('prot.actionSuccess'));
        setSelected(null);
        refetch();
        queryClient.invalidateQueries({ queryKey: ['admin-marketplace-orders'] });
      } else {
        toast.error(json.error || t('prot.actionFailed'));
      }
    } catch {
      toast.error(t('prot.actionFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <RotateCcw className="h-5 w-5 text-primary" />
            {t('adminNav.refunds')}
          </h2>
          <p className="text-[12px] text-muted-foreground">{t('adminProt.refundVerifyNote')}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('adminProt.searchPh')} className="h-10 rounded-xl pl-9" />
        </div>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {statChips.map((c) => (
          <button
            key={c.key}
            onClick={() => setStatus(c.key)}
            className={cn(
              'rounded-xl border px-3 py-2 text-left transition-colors',
              status === c.key ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/25' : 'border-border/60 hover:border-primary/30',
            )}
          >
            <p className="text-[10px] font-medium text-muted-foreground">{c.label}</p>
            <p className="text-sm font-bold text-foreground">
              {c.value}{c.extra ? <span className="ml-1 text-[10px] font-medium text-muted-foreground">{c.extra}</span> : null}
            </p>
          </button>
        ))}
        <button
          onClick={() => setStatus('all')}
          className={cn(
            'rounded-xl border px-3 py-2 text-left transition-colors',
            status === 'all' ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/25' : 'border-border/60 hover:border-primary/30',
          )}
        >
          <p className="text-[10px] font-medium text-muted-foreground">{t('adminProt.all')}</p>
          <p className="text-sm font-bold text-foreground">{rows.length}{isFetching ? '…' : ''}</p>
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="mt-2 text-sm">{t('adminProt.noData')}</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white p-4 text-left transition-colors hover:border-primary/30 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-bold text-foreground" dir="ltr">{r.order.orderNumber}</span>
                  <StatusChip status={r.status} />
                </div>
                <p className="mt-1 truncate text-[13px] font-semibold text-foreground">{r.order.serviceName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t('adminProt.buyer')}: {r.order.user.name} · {r.order.user.phone}
                  {r.order.seller ? ` · ${t('adminProt.seller')}: ${r.order.seller.name}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold text-primary">৳{r.amount.toLocaleString('en')}</p>
                <p className="text-[10px] text-muted-foreground" dir="ltr">
                  {new Date(r.createdAt).toLocaleDateString('en-GB')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail / action dialog */}
      <RefundDetailDialog request={selected} onClose={() => setSelected(null)} onAction={onAction} />
    </div>
  );
}

function RefundDetailDialog({
  request,
  onClose,
  onAction,
}: {
  request: RefundRow | null;
  onClose: () => void;
  onAction: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const t = useT();
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('');
  const [infoNote, setInfoNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'view' | 'reject' | 'info' | 'refund'>('view');

  const close = () => { setMode('view'); setNote(''); setReference(''); setMethod(''); setInfoNote(''); onClose(); };

  const run = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try { await onAction(payload); } finally { setBusy(false); }
  };

  if (!request) return null;
  const s = request.status;

  return (
    <Dialog open={!!request} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-[15px]">
            {request.order.orderNumber} <StatusChip status={s} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[13px]">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="font-semibold text-foreground">{request.order.serviceName}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {t('adminProt.buyer')}: {request.order.user.name} ({request.order.user.phone} · {request.order.user.email})
            </p>
            {request.order.seller && (
              <p className="text-[12px] text-muted-foreground">{t('adminProt.seller')}: {request.order.seller.name}</p>
            )}
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t('adminProt.order')}: ৳{request.order.totalAmount.toLocaleString('en')} · {request.order.status} / {request.order.paymentStatus}
              {request.order.product ? ` · ${request.order.product.itemType}` : ' · service'}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('prot.reason')}</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/30 p-2.5 leading-relaxed text-foreground">{request.reason}</p>
          </div>

          {request.evidence && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('prot.evidence')}</p>
              <div className="mt-1.5"><EvidenceChips orderId={request.orderId} evidenceJson={request.evidence} /></div>
            </div>
          )}

          {request.infoRequest && (
            <p className="rounded-lg bg-sky-500/10 p-2.5 text-[12px] text-sky-700 dark:text-sky-300">
              <span className="font-bold">{t('prot.refundInfoNeeded')}:</span> {request.infoRequest}
            </p>
          )}
          {request.adminNote && (
            <p className="rounded-lg bg-muted/30 p-2.5 text-[12px] text-muted-foreground"><span className="font-bold">{t('prot.refundAdminNote')}:</span> {request.adminNote}</p>
          )}
          {request.refundReference && (
            <p className="rounded-lg bg-emerald-500/10 p-2.5 text-[12px] text-emerald-700 dark:text-emerald-300">
              <span className="font-bold">{t('prot.refundReference')}:</span> <span className="font-mono">{request.refundReference}</span>
              {request.refundMethod ? ` · ${request.refundMethod}` : ''}
            </p>
          )}

          {/* ── Action modes ── */}
          {mode === 'reject' && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-500/30 dark:bg-red-500/10">
              <Label className="text-[12px] font-semibold">{t('adminProt.rejectNotePh')}</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="rounded-lg text-[13px]" />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !note.trim()} onClick={() => run({ action: 'reject', note: note.trim() })} className="h-8 rounded-lg text-[12px] font-semibold bg-destructive text-white hover:bg-destructive/90">
                  {t('prot.reject')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode('view')} className="h-8 rounded-lg px-3 text-[12px] font-semibold">{t('marketplace.cancel')}</Button>
              </div>
            </div>
          )}

          {mode === 'info' && (
            <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-500/30 dark:bg-sky-500/10">
              <Label className="text-[12px] font-semibold">{t('adminProt.requestInfoPh')}</Label>
              <Textarea value={infoNote} onChange={(e) => setInfoNote(e.target.value)} rows={2} maxLength={500} className="rounded-lg text-[13px]" />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !infoNote.trim()} onClick={() => run({ action: 'request_info', note: infoNote.trim() })} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('adminProt.requestInfoTitle')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode('view')} className="h-8 rounded-lg px-3 text-[12px] font-semibold">{t('marketplace.cancel')}</Button>
              </div>
            </div>
          )}

          {mode === 'refund' && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{t('adminProt.refundVerifyNote')}</p>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold">{t('adminProt.refundReferenceLabel')} *</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('adminProt.refundReferencePh')} className="h-9 rounded-lg text-[13px]" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold">{t('prot.refundMethodLabel')}</Label>
                <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder={t('adminProt.refundMethodPh')} className="h-9 rounded-lg text-[13px]" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !reference.trim()} onClick={() => run({ action: 'mark_refunded', refundReference: reference.trim(), refundMethod: method.trim() || undefined })} className="h-8 rounded-lg text-[12px] font-semibold">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t('adminProt.markRefunded')} — ৳{request.amount.toLocaleString('en')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode('view')} className="h-8 rounded-lg px-3 text-[12px] font-semibold">{t('marketplace.cancel')}</Button>
              </div>
            </div>
          )}

          {/* ── Quick actions by status ── */}
          {mode === 'view' && s !== 'refunded' && (
            <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
              {s === 'requested' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: 'under_review' })} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('prot.refundStatus.under_review')}
                </Button>
              )}
              {['requested', 'under_review'].includes(s) && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode('info')} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('adminProt.requestInfoTitle')}
                </Button>
              )}
              {['requested', 'under_review'].includes(s) && (
                <Button size="sm" disabled={busy} onClick={() => run({ action: 'approve' })} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('prot.approve')}
                </Button>
              )}
              {s !== 'rejected' && s !== 'processing' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode('reject')} className="h-8 rounded-lg text-[12px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive">
                  {t('prot.reject')}
                </Button>
              )}
              {s === 'approved' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: 'start_processing' })} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('adminProt.startProcessing')}
                </Button>
              )}
              {['approved', 'processing'].includes(s) && (
                <Button size="sm" disabled={busy} onClick={() => setMode('refund')} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('adminProt.markRefunded')}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
