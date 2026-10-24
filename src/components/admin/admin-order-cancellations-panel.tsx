'use client';

/**
 * Admin Order Cancellations Panel — Phase 6.
 * Buyer cancellation requests with seller/admin decision state.
 * Admin can approve (unverified-payment orders cancel directly;
 * paid orders spawn a refund) or reject with a reason.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Search, Loader2, Inbox, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface CancellationRow {
  id: string;
  orderId: string;
  reason: string;
  requestedByRole: string;
  status: string;
  decidedByRole: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  refundRequestId: string | null;
  createdAt: string;
  order: {
    id: string; orderNumber: string; serviceName: string; status: string;
    paymentStatus: string; totalAmount: number;
    user: { id: string; name: string; email: string; phone: string };
    seller: { id: string; name: string } | null;
    product: { itemType: string } | null;
  };
}

interface CancellationsResponse {
  requests: CancellationRow[];
  stats: { pendingCount: number; approvedCount: number; rejectedCount: number };
}

function StatusChip({ status }: { status: string }) {
  const t = useT();
  const key: Record<string, TranslationKey> = {
    pending: 'prot.cancelPending',
    approved: 'prot.cancelApproved',
    rejected: 'prot.cancelRejected',
  };
  const cls: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cls[status] ?? 'bg-muted text-muted-foreground')}>
      {t(key[status] ?? 'adminProt.all')}
    </span>
  );
}

export function AdminOrderCancellationsPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<CancellationRow | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ status });
    if (q) p.set('q', q);
    return p.toString();
  }, [status, q]);

  const { data, isLoading, refetch } = useQuery<CancellationsResponse>({
    queryKey: ['admin-cancellations', params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/cancellations?${params}`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const rows = data?.requests ?? [];
  const stats = data?.stats;

  const decide = async (action: 'approve' | 'reject', note?: string) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/orders/${selected.orderId}/cancellation-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t('prot.actionSuccess'));
        setSelected(null);
        refetch();
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
            <Ban className="h-5 w-5 text-primary" />
            {t('adminNav.orderCancellations')}
          </h2>
          <p className="text-[12px] text-muted-foreground">{t('prot.sellerAdminOnlyNote')}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('adminProt.searchPh')} className="h-10 rounded-xl pl-9" />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {stats && [
          { key: 'pending', label: t('adminProt.pending'), value: stats.pendingCount },
          { key: 'approved', label: t('adminProt.approved'), value: stats.approvedCount },
          { key: 'rejected', label: t('adminProt.rejected'), value: stats.rejectedCount },
        ].map((c) => (
          <button
            key={c.key}
            onClick={() => setStatus(c.key)}
            className={cn(
              'rounded-xl border px-3 py-2 text-left transition-colors',
              status === c.key ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/25' : 'border-border/60 hover:border-primary/30',
            )}
          >
            <p className="text-[10px] font-medium text-muted-foreground">{c.label}</p>
            <p className="text-sm font-bold text-foreground">{c.value}</p>
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
          <p className="text-sm font-bold text-foreground">{rows.length}</p>
        </button>
      </div>

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
                  {r.order.paymentStatus === 'awaiting_verification' && r.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                      <Clock className="h-3 w-3" />admin only
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[13px] font-semibold text-foreground">{r.order.serviceName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t('adminProt.buyer')}: {r.order.user.name} · {r.order.user.phone}
                  {r.order.seller ? ` · ${t('adminProt.seller')}: ${r.order.seller.name}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold text-primary">৳{r.order.totalAmount.toLocaleString('en')}</p>
                <p className="text-[10px] text-muted-foreground" dir="ltr">{new Date(r.createdAt).toLocaleDateString('en-GB')}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Decision dialog */}
      <CancellationDecisionDialog request={selected} onClose={() => setSelected(null)} onDecide={decide} />
    </div>
  );
}

function CancellationDecisionDialog({
  request,
  onClose,
  onDecide,
}: {
  request: CancellationRow | null;
  onClose: () => void;
  onDecide: (action: 'approve' | 'reject', note?: string) => Promise<void>;
}) {
  const t = useT();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: 'approve' | 'reject') => {
    setBusy(true);
    try { await onDecide(action, note.trim() || undefined); } finally { setBusy(false); }
  };

  if (!request) return null;
  const adminOnly = request.order.paymentStatus === 'awaiting_verification' && request.status === 'pending';

  return (
    <Dialog open={!!request} onOpenChange={(v) => { if (!v) { setNote(''); onClose(); } }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-[15px]">
            {request.order.orderNumber} <StatusChip status={request.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[13px]">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="font-semibold text-foreground">{request.order.serviceName}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {t('adminProt.buyer')}: {request.order.user.name} ({request.order.user.phone})
            </p>
            {request.order.seller && (
              <p className="text-[12px] text-muted-foreground">{t('adminProt.seller')}: {request.order.seller.name}</p>
            )}
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t('adminProt.order')}: ৳{request.order.totalAmount.toLocaleString('en')} · {request.order.status} / {request.order.paymentStatus}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('prot.reason')}</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/30 p-2.5 leading-relaxed text-foreground">{request.reason}</p>
          </div>

          {request.decisionNote && (
            <p className="rounded-lg bg-muted/30 p-2.5 text-[12px] text-muted-foreground">
              <span className="font-bold">{t('prot.decisionNote')}:</span> {request.decisionNote}
            </p>
          )}

          {request.status === 'pending' && (
            <div className="space-y-2.5 border-t border-border/40 pt-3">
              {adminOnly && (
                <p className="rounded-lg bg-sky-500/10 p-2.5 text-[11px] text-sky-700 dark:text-sky-300">{t('prot.sellerAdminOnlyNote')}</p>
              )}
              {request.order.paymentStatus === 'paid' && (
                <p className="rounded-lg bg-emerald-500/10 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300">{t('prot.approveRefundNote')}</p>
              )}
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold">{t('prot.decisionNotePh')}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="rounded-lg text-[13px]" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => run('approve')} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('prot.approve')}
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run('reject')} className="h-8 rounded-lg text-[12px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive">
                  {t('prot.reject')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
