'use client';

/**
 * Admin Order Disputes Panel — Phase 6.
 * Marketplace-order dispute inbox (separate from Deal disputes):
 * review the order context + two-sided evidence thread, post admin
 * messages, and record the decision (refund / cancel / complete /
 * rejected / none) with a resolution note. Every action is audited.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldAlert, Search, Loader2, Inbox, Send, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { EvidenceChips } from '@/components/shared/order-protection';

interface DisputeRow {
  id: string;
  orderId: string;
  raisedByRole: string;
  category: string;
  description: string;
  evidence: string | null;
  status: string;
  resolution: string | null;
  outcome: string | null;
  resolvedAt: string | null;
  createdAt: string;
  messageCount?: number;
  order: {
    id: string; orderNumber: string; serviceName: string; status: string;
    paymentStatus: string; totalAmount: number;
    user: { id: string; name: string; email: string; phone: string };
    seller: { id: string; name: string } | null;
    product: { itemType: string } | null;
  };
}

interface DisputesResponse {
  disputes: DisputeRow[];
  stats: { openCount: number; underReviewCount: number; resolvedCount: number; rejectedCount: number };
}

interface ThreadMessage {
  id: string;
  senderRole: string;
  text: string;
  attachments: string | null;
  createdAt: string;
}

const OUTCOMES = ['refund', 'cancel', 'complete', 'rejected', 'none'] as const;

export function AdminOrderDisputesPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<DisputeRow | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ status });
    if (q) p.set('q', q);
    return p.toString();
  }, [status, q]);

  const { data, isLoading, refetch } = useQuery<DisputesResponse>({
    queryKey: ['admin-order-disputes', params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/order-disputes?${params}`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const rows = data?.disputes ?? [];
  const stats = data?.stats;

  const refreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['admin-marketplace-orders'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <ShieldAlert className="h-5 w-5 text-primary" />
            {t('adminNav.orderDisputes')}
          </h2>
          <p className="text-[12px] text-muted-foreground">{t('adminProt.resumeNote')}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('adminProt.searchPh')} className="h-10 rounded-xl pl-9" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {stats && [
          { key: 'open', label: t('prot.disputeStatus.open'), value: stats.openCount },
          { key: 'under_review', label: t('prot.disputeStatus.under_review'), value: stats.underReviewCount },
          { key: 'resolved', label: t('prot.disputeStatus.resolved'), value: stats.resolvedCount },
          { key: 'rejected', label: t('prot.disputeStatus.rejected'), value: stats.rejectedCount },
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
          {rows.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white p-4 text-left transition-colors hover:border-primary/30 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-bold text-foreground" dir="ltr">{d.order.orderNumber}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    d.status === 'open' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : d.status === 'under_review' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                      : d.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-700 dark:text-red-400',
                  )}>
                    {t(`prot.disputeStatus.${d.status}` as TranslationKey)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[13px] font-semibold text-foreground">
                  {t(`prot.disputeCat.${d.category}` as TranslationKey)} — {d.order.serviceName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t('adminProt.buyer')}: {d.order.user.name}{d.order.seller ? ` · ${t('adminProt.seller')}: ${d.order.seller.name}` : ''} · {t('prot.role.' + d.raisedByRole as TranslationKey)} {t('prot.reason')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold text-primary">৳{d.order.totalAmount.toLocaleString('en')}</p>
                <p className="text-[10px] text-muted-foreground" dir="ltr">{new Date(d.createdAt).toLocaleDateString('en-GB')}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <DisputeDetailDialog dispute={selected} onClose={() => setSelected(null)} onChanged={refreshAll} />
    </div>
  );
}

function DisputeDetailDialog({
  dispute,
  onClose,
  onChanged,
}: {
  dispute: DisputeRow | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [resolution, setResolution] = useState('');
  const [outcome, setOutcome] = useState<string>('refund');
  const [busy, setBusy] = useState(false);

  // Load the full thread when the dialog opens
  useEffect(() => {
    if (!dispute) { setMessages([]); setResolution(''); setOutcome('refund'); return; }
    setThreadLoading(true);
    fetch(`/api/orders/${dispute.orderId}/disputes`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.dispute) {
          setMessages(json.dispute.messages ?? []);
          if (json.dispute.resolution) setResolution(json.dispute.resolution);
        }
      })
      .catch(() => {})
      .finally(() => setThreadLoading(false));
  }, [dispute?.id]);

  if (!dispute) return null;

  const postMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${dispute.orderId}/disputes/${dispute.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMessages((prev) => [...prev, json.message]);
        setMessage('');
      } else {
        toast.error(json.error || t('prot.actionFailed'));
      }
    } catch {
      toast.error(t('prot.actionFailed'));
    } finally {
      setSending(false);
    }
  };

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/order-disputes/${dispute.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t('prot.actionSuccess'));
        onChanged();
        onClose();
      } else {
        toast.error(json.error || t('prot.actionFailed'));
      }
    } catch {
      toast.error(t('prot.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const open = dispute.status === 'open' || dispute.status === 'under_review';

  return (
    <Dialog open={!!dispute} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-[15px]">
            {dispute.order.orderNumber}
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              dispute.status === 'open' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : dispute.status === 'under_review' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                : dispute.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-700 dark:text-red-400',
            )}>
              {t(`prot.disputeStatus.${dispute.status}` as TranslationKey)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[13px]">
          {/* Order + payment context */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="font-semibold text-foreground">{dispute.order.serviceName}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {t('adminProt.buyer')}: {dispute.order.user.name} ({dispute.order.user.phone} · {dispute.order.user.email})
            </p>
            {dispute.order.seller && (
              <p className="text-[12px] text-muted-foreground">{t('adminProt.seller')}: {dispute.order.seller.name}</p>
            )}
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t('adminProt.order')}: ৳{dispute.order.totalAmount.toLocaleString('en')} · {dispute.order.status} / {dispute.order.paymentStatus}
              {dispute.order.product ? ` · ${dispute.order.product.itemType}` : ' · service'}
            </p>
          </div>

          {/* Claim */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t('prot.disputeCategory')}: {t(`prot.disputeCat.${dispute.category}` as TranslationKey)} · {t('prot.role.' + dispute.raisedByRole as TranslationKey)}
            </p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-red-500/5 p-2.5 leading-relaxed text-foreground">{dispute.description}</p>
            {dispute.evidence && <div className="mt-1.5"><EvidenceChips orderId={dispute.orderId} evidenceJson={dispute.evidence} /></div>}
          </div>

          {/* Thread */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('prot.disputeThread')}</p>
            {threadLoading ? (
              <div className="mt-2 flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="mt-1.5 max-h-56 space-y-1.5 overflow-y-auto rounded-lg bg-muted/20 p-2">
                {messages.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">{t('adminProt.noData')}</p>
                ) : messages.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border/40 bg-background/60 p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {t(`prot.role.${m.senderRole}` as TranslationKey)}
                      </span>
                      <span className="text-[10px] text-muted-foreground" dir="ltr">
                        {new Date(m.createdAt).toLocaleString('en-GB', { hour12: true })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">{m.text}</p>
                    {m.attachments && <div className="mt-1.5"><EvidenceChips orderId={dispute.orderId} evidenceJson={m.attachments} /></div>}
                  </div>
                ))}
              </div>
            )}
            {open && (
              <div className="mt-2 flex items-end gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('prot.disputeMessagePh')}
                  rows={2}
                  maxLength={2000}
                  className="min-h-0 flex-1 rounded-lg text-[12px]"
                />
                <Button size="sm" onClick={postMessage} disabled={sending || !message.trim()} className="h-9 gap-1.5 rounded-lg text-[12px] font-semibold">
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {t('prot.disputeSend')}
                </Button>
              </div>
            )}
          </div>

          {/* Resolution */}
          {dispute.resolution && (
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {t('prot.disputeResolution')} {dispute.outcome ? `— ${t(`prot.disputeOutcome.${dispute.outcome}` as TranslationKey)}` : ''}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-foreground">{dispute.resolution}</p>
            </div>
          )}

          {/* Admin actions */}
          {open && (
            <div className="space-y-2.5 border-t border-border/40 pt-3">
              {dispute.status === 'open' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: 'under_review' })} className="h-8 rounded-lg text-[12px] font-semibold">
                  {t('prot.disputeStatus.under_review')}
                </Button>
              )}
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold">{t('adminProt.outcome')}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOMES.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOutcome(o)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        outcome === o
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 text-muted-foreground hover:border-primary/30',
                      )}
                    >
                      {t(`prot.disputeOutcome.${o}` as TranslationKey)}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder={t('adminProt.resolutionPh')}
                rows={2}
                maxLength={1000}
                className="rounded-lg text-[13px]"
              />
              <Button size="sm" disabled={busy || !resolution.trim()} onClick={() => act({ action: 'resolve', outcome, resolution: resolution.trim() })} className="h-8 rounded-lg text-[12px] font-semibold">
                {t('adminProt.resolveTitle')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
