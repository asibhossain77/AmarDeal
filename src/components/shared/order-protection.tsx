'use client';

/**
 * OrderProtectionSection — Phase 6 buyer-protection UI block.
 *
 * Renders the cancellation / refund / dispute state of a marketplace
 * order and the request forms for eligible viewers. All eligibility
 * checks re-run server-side on every call — these client rules are
 * display-only hints that mirror src/lib/order-protection.ts.
 *
 * Used by the buyer OrderDetailPanel AND the shared OrderDetailsDialog
 * (seller view). Evidence files upload to the order-scoped R2 space
 * and download through the participant-guarded presign route.
 */

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Ban, RotateCcw, ShieldAlert, Loader2, Paperclip, FileText, Download,
  XCircle, Clock, Send, MessageSquare, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useT, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/* ── Payload types (JSON from /api/marketplace/orders/[id]) ───── */

export interface EvidenceMeta {
  key: string;
  fileName: string;
  fileSize: number;
  fileType: string | null;
}

export interface CancellationRequestData {
  id: string;
  status: string; // pending | approved | rejected
  reason: string;
  requestedByRole: string;
  decidedByRole: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  refundRequestId: string | null;
  createdAt: string;
}

export interface RefundRequestData {
  id: string;
  status: string; // requested | under_review | approved | rejected | processing | refunded
  reason?: string | null;
  amount: number;
  adminNote?: string | null;
  infoRequest?: string | null;
  refundMethod?: string | null;
  refundReference?: string | null;
  refundedAt?: string | null;
  evidence?: string | null;
  createdAt: string;
}

export interface DisputeMessageData {
  id: string;
  senderId: string;
  senderRole: string; // buyer | seller | admin
  text: string;
  attachments?: string | null;
  createdAt: string;
}

export interface DisputeData {
  id: string;
  raisedByRole: string; // buyer | seller
  category: string;
  description: string;
  evidence?: string | null;
  status: string; // open | under_review | resolved | rejected
  resolution?: string | null;
  outcome?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  messages?: DisputeMessageData[];
}

export interface ProtectionOrderInfo {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  refundedAt: string | null;
  /** null for service orders */
  productItemType: string | null;
  hasProduct: boolean;
  cancellationRequest: CancellationRequestData | null;
  refundRequest: RefundRequestData | null;
  dispute: DisputeData | null;
}

export type ProtectionViewerRole = 'buyer' | 'seller' | 'admin';

/* ── Display-only eligibility mirrors (server re-validates) ───── */

const CANCEL_REQUESTABLE = new Set(['pending_payment', 'queued', 'processing', 'in_progress']);
const REFUND_PRE_DELIVERY = new Set(['queued', 'processing', 'in_progress']);
const REFUND_PHYSICAL = new Set(['queued', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed']);
const REFUND_SERVICE = new Set(['queued', 'processing', 'in_progress', 'partial']);
const DISPUTE_ELIGIBLE = new Set(['queued', 'processing', 'in_progress', 'shipped', 'out_for_delivery', 'delivered', 'completed']);

export function canRequestCancellation(o: ProtectionOrderInfo): boolean {
  if (o.cancellationRequest) return false;
  if (!CANCEL_REQUESTABLE.has(o.status)) return false;
  if (o.status === 'pending_payment') return o.paymentStatus === 'awaiting_verification';
  return o.paymentStatus === 'paid';
}

export function canRequestRefund(o: ProtectionOrderInfo): boolean {
  if (o.refundRequest || o.refundedAt) return false;
  if (o.paymentStatus !== 'paid' || o.status === 'disputed') return false;
  if (!o.hasProduct) return REFUND_SERVICE.has(o.status);
  if (o.productItemType === 'physical') return REFUND_PHYSICAL.has(o.status);
  return REFUND_PRE_DELIVERY.has(o.status);
}

export function canOpenDispute(o: ProtectionOrderInfo): boolean {
  if (o.dispute) return false;
  if (o.paymentStatus !== 'paid') return false;
  return DISPUTE_ELIGIBLE.has(o.status);
}

/* ── Small presentational helpers ─────────────────────────────── */

function statusChipClass(status: string): string {
  switch (status) {
    case 'pending':
    case 'requested':
    case 'open':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'under_review':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-400';
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'processing':
      return 'bg-violet-500/10 text-violet-700 dark:text-violet-400';
    case 'refunded':
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'rejected':
      return 'bg-red-500/10 text-red-700 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function RoleChip({ role }: { role: string }) {
  const t = useT();
  const key = `prot.role.${role}` as TranslationKey;
  return (
    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
      {t(key)}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[11px] text-muted-foreground">
      <span className="font-semibold">{label}:</span> {value}
    </p>
  );
}

/* ── Evidence picker + chips ──────────────────────────────────── */

function EvidencePicker({
  orderId,
  files,
  onChange,
}: {
  orderId: string;
  files: EvidenceMeta[];
  onChange: (files: EvidenceMeta[]) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (files.length >= 5) {
      toast.error(t('prot.evidenceMax'));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/orders/${orderId}/evidence-upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        onChange([...files, { key: data.key, fileName: data.fileName, fileSize: data.fileSize, fileType: data.fileType }]);
      } else {
        toast.error(data.error || t('prot.uploadFailed'));
      }
    } catch {
      toast.error(t('prot.uploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || files.length >= 5}
          onClick={() => inputRef.current?.click()}
          className="h-8 gap-1.5 rounded-lg text-[12px]"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {uploading ? t('prot.uploading') : t('prot.evidenceAdd')}
        </Button>
        <span className="text-[10px] text-muted-foreground">{t('prot.evidenceMax')}</span>
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f) => (
            <span key={f.key} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] text-foreground">
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="max-w-[160px] truncate">{f.fileName}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x.key !== f.key))}
                className="text-muted-foreground hover:text-destructive"
                aria-label="remove"
              >
                <XCircle className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EvidenceChips({ orderId, evidenceJson }: { orderId: string; evidenceJson: string | null | undefined }) {
  if (!evidenceJson) return null;
  let files: EvidenceMeta[] = [];
  try {
    const parsed = JSON.parse(evidenceJson);
    if (Array.isArray(parsed)) files = parsed;
  } catch { /* ignore */ }
  if (!files.length) return null;

  const open = async (key: string, name: string) => {
    try {
      const res = await fetch(`/api/evidence-file?key=${encodeURIComponent(key)}&orderId=${encodeURIComponent(orderId)}&name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, '_blank', 'noopener');
      else toast.error(data.error || 'Failed');
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => open(f.key, f.fileName)}
          className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border/50 bg-background/60 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5"
        >
          <Download className="h-3 w-3 shrink-0" />
          <span className="max-w-[160px] truncate">{f.fileName}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main section
   ═══════════════════════════════════════════════════════════════ */

export function OrderProtectionSection({
  order,
  viewerRole,
  onChanged,
}: {
  order: ProtectionOrderInfo;
  viewerRole: ProtectionViewerRole;
  onChanged?: () => void;
}) {
  const t = useT();
  const act = viewerRole === 'buyer' || viewerRole === 'seller';

  const showCancelCard = !!order.cancellationRequest || (act && canRequestCancellation(order));
  const showRefundCard = !!order.refundRequest || (act && canRequestRefund(order));
  const showDisputeCard = !!order.dispute || (act && canOpenDispute(order));
  if (!showCancelCard && !showRefundCard && !showDisputeCard) return null;

  return (
    <div className="space-y-3">
      {showCancelCard && (
        <CancellationCard order={order} viewerRole={viewerRole} onChanged={onChanged} />
      )}
      {showRefundCard && (
        <RefundCard order={order} viewerRole={viewerRole} onChanged={onChanged} />
      )}
      {showDisputeCard && (
        <DisputeCard order={order} viewerRole={viewerRole} onChanged={onChanged} />
      )}
    </div>
  );
}

/* ── Cancellation ─────────────────────────────────────────────── */

function CancellationCard({
  order,
  viewerRole,
  onChanged,
}: {
  order: ProtectionOrderInfo;
  viewerRole: ProtectionViewerRole;
  onChanged?: () => void;
}) {
  const t = useT();
  const [openForm, setOpenForm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const req = order.cancellationRequest;

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancellation-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('prot.submittedSuccess'));
        setOpenForm(false);
        setReason('');
        onChanged?.();
      } else {
        toast.error(data.error || t('prot.actionFailed'));
      }
    } catch {
      toast.error(t('prot.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const statusKey = req ? (`prot.cancel${req.status.charAt(0).toUpperCase()}${req.status.slice(1)}` as TranslationKey) : null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
          <Ban className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          {t('prot.cancelTitle')}
        </p>
        {req && (
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', statusChipClass(req.status))}>
            {statusKey ? t(statusKey) : req.status}
          </span>
        )}
      </div>

      {!req && openForm && (
        <div className="mt-2.5 space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('prot.cancelReasonPh')}
            rows={3}
            maxLength={500}
            className="rounded-lg bg-background/70 text-[13px]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy || !reason.trim()} className="h-8 gap-1.5 rounded-lg text-[12px] font-semibold">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              {t('prot.cancelSubmit')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpenForm(false)} disabled={busy} className="h-8 rounded-lg px-3 text-[12px] font-semibold">
              {t('marketplace.cancel')}
            </Button>
          </div>
        </div>
      )}

      {!req && !openForm && viewerRole !== 'admin' && canRequestCancellation(order) && (
        <Button size="sm" variant="outline" onClick={() => setOpenForm(true)} className="mt-2 h-8 gap-1.5 rounded-lg text-[12px] font-semibold">
          <Ban className="h-3.5 w-3.5" />
          {t('prot.cancelRequest')}
        </Button>
      )}

      {req && (
        <div className="mt-2 space-y-1.5">
          <Meta label={t('prot.reason')} value={req.reason} />
          <Meta label={t('prot.requestedAt')} value={new Date(req.createdAt).toLocaleString('en-GB', { hour12: true })} />
          {req.decisionNote && <Meta label={t('prot.decisionNote')} value={req.decisionNote} />}
          {req.status === 'pending' && <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400"><Clock className="h-3 w-3" />{t('prot.cancelAwaitingNote')}</p>}
          {req.status === 'approved' && (
            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              {req.refundRequestId ? t('prot.cancelApprovedRefundNote') : t('prot.cancelApprovedCancelledNote')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Refund ───────────────────────────────────────────────────── */

const REFUND_STEPS = ['requested', 'under_review', 'approved', 'processing', 'refunded'] as const;

function RefundCard({
  order,
  viewerRole,
  onChanged,
}: {
  order: ProtectionOrderInfo;
  viewerRole: ProtectionViewerRole;
  onChanged?: () => void;
}) {
  const t = useT();
  const [openForm, setOpenForm] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [files, setFiles] = useState<EvidenceMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const req = order.refundRequest;

  const submit = async () => {
    const amt = Number(amount);
    if (!reason.trim() || !Number.isFinite(amt) || amt <= 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, reason: reason.trim(), amount: amt, evidence: files }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('prot.submittedSuccess'));
        setOpenForm(false);
        setReason('');
        setAmount('');
        setFiles([]);
        onChanged?.();
      } else {
        toast.error(data.error || t('prot.actionFailed'));
      }
    } catch {
      toast.error(t('prot.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const stepIdx = req ? REFUND_STEPS.indexOf(req.status as (typeof REFUND_STEPS)[number]) : -1;
  const isTerminalBad = req?.status === 'rejected';

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3.5 dark:border-violet-500/30 dark:bg-violet-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
          <RotateCcw className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          {t('prot.refundTitle')}
        </p>
        {req && (
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', statusChipClass(req.status))}>
            {t(`prot.refundStatus.${req.status}` as TranslationKey)}
          </span>
        )}
      </div>

      {/* Progress steps */}
      {req && !isTerminalBad && (
        <div className="mt-2.5 flex items-center gap-1" aria-hidden>
          {REFUND_STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1">
              <div className={cn('h-1.5 rounded-full', i <= stepIdx ? 'bg-violet-500' : 'bg-violet-200/60 dark:bg-violet-500/20')} />
              <span className={cn('text-[9px] font-medium leading-tight', i <= stepIdx ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground')}>
                {t(`prot.refundStatus.${s}` as TranslationKey)}
              </span>
            </div>
          ))}
        </div>
      )}

      {!req && openForm && (
        <div className="mt-2.5 space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('prot.refundReasonPh')}
            rows={3}
            maxLength={1000}
            className="rounded-lg bg-background/70 text-[13px]"
          />
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min={1}
            max={order.totalAmount}
            step="0.01"
            placeholder={`${t('prot.refundAmount')} — max ৳${order.totalAmount.toLocaleString('en')}`}
            className="h-9 rounded-lg bg-background/70 text-[13px]"
            dir="ltr"
          />
          <EvidencePicker orderId={order.id} files={files} onChange={setFiles} />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy || !reason.trim() || !(Number(amount) > 0)} className="h-8 gap-1.5 rounded-lg text-[12px] font-semibold">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {t('prot.refundSubmit')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpenForm(false)} disabled={busy} className="h-8 rounded-lg px-3 text-[12px] font-semibold">
              {t('marketplace.cancel')}
            </Button>
          </div>
        </div>
      )}

      {!req && !openForm && viewerRole !== 'admin' && canRequestRefund(order) && (
        <Button size="sm" variant="outline" onClick={() => setOpenForm(true)} className="mt-2 h-8 gap-1.5 rounded-lg text-[12px] font-semibold">
          <RotateCcw className="h-3.5 w-3.5" />
          {t('prot.refundRequest')}
        </Button>
      )}

      {req && (
        <div className="mt-2 space-y-1.5">
          {req.reason && viewerRole !== 'seller' && <Meta label={t('prot.reason')} value={req.reason} />}
          <Meta label={t('prot.amount')} value={`৳${req.amount.toLocaleString('en')}`} />
          {req.infoRequest && (
            <p className="flex items-start gap-1.5 rounded-lg bg-sky-500/10 p-2 text-[11px] text-sky-700 dark:text-sky-300">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span><span className="font-bold">{t('prot.refundInfoNeeded')}:</span> {req.infoRequest}</span>
            </p>
          )}
          {req.adminNote && <Meta label={t('prot.refundAdminNote')} value={req.adminNote} />}
          {req.refundMethod && <Meta label={t('prot.refundMethodLabel')} value={req.refundMethod} />}
          {req.refundReference && <Meta label={t('prot.refundReference')} value={req.refundReference} />}
          {req.refundedAt && <Meta label={t('prot.refundStatus.refunded')} value={new Date(req.refundedAt).toLocaleString('en-GB', { hour12: true })} />}
          {req.evidence && <EvidenceChips orderId={order.id} evidenceJson={req.evidence} />}
        </div>
      )}
    </div>
  );
}

/* ── Dispute ──────────────────────────────────────────────────── */

const DISPUTE_CATEGORIES = ['item_not_received', 'not_as_described', 'damaged_physical', 'incorrect_digital', 'other'] as const;

function DisputeCard({
  order,
  viewerRole,
  onChanged,
}: {
  order: ProtectionOrderInfo;
  viewerRole: ProtectionViewerRole;
  onChanged?: () => void;
}) {
  const t = useT();
  const [openForm, setOpenForm] = useState(false);
  const [category, setCategory] = useState<string>('other');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<EvidenceMeta[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const dispute = order.dispute;

  const submit = async () => {
    if (!description.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, description: description.trim(), evidence: files }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('prot.submittedSuccess'));
        setOpenForm(false);
        setDescription('');
        setFiles([]);
        onChanged?.();
      } else {
        toast.error(data.error || t('prot.actionFailed'));
      }
    } catch {
      toast.error(t('prot.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !dispute) return;
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/disputes/${dispute.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('');
        onChanged?.();
      } else {
        toast.error(data.error || t('prot.actionFailed'));
      }
    } catch {
      toast.error(t('prot.actionFailed'));
    } finally {
      setSending(false);
    }
  };

  const threadOpen = dispute && ['open', 'under_review'].includes(dispute.status);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 dark:border-red-500/30 dark:bg-red-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          {t('prot.disputeTitle')}
        </p>
        {dispute && (
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', statusChipClass(dispute.status))}>
            {t(`prot.disputeStatus.${dispute.status}` as TranslationKey)}
          </span>
        )}
      </div>

      {!dispute && openForm && (
        <div className="mt-2.5 space-y-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground">{t('prot.disputeCategory')}</p>
            <div className="flex flex-wrap gap-1.5">
              {DISPUTE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    category === c
                      ? 'border-red-400 bg-red-500/10 text-red-700 dark:text-red-300'
                      : 'border-border/50 bg-background/60 text-muted-foreground hover:border-red-300',
                  )}
                >
                  {t(`prot.disputeCat.${c}` as TranslationKey)}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('prot.disputeDescPh')}
            rows={3}
            maxLength={2000}
            className="rounded-lg bg-background/70 text-[13px]"
          />
          <EvidencePicker orderId={order.id} files={files} onChange={setFiles} />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy || !description.trim()} className="h-8 gap-1.5 rounded-lg text-[12px] font-semibold">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {t('prot.disputeSubmit')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpenForm(false)} disabled={busy} className="h-8 rounded-lg px-3 text-[12px] font-semibold">
              {t('marketplace.cancel')}
            </Button>
          </div>
        </div>
      )}

      {!dispute && !openForm && viewerRole !== 'admin' && canOpenDispute(order) && (
        <Button size="sm" variant="outline" onClick={() => setOpenForm(true)} className="mt-2 h-8 gap-1.5 rounded-lg text-[12px] font-semibold text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400">
          <ShieldAlert className="h-3.5 w-3.5" />
          {t('prot.disputeRequest')}
        </Button>
      )}

      {dispute && (
        <div className="mt-2 space-y-2">
          <Meta label={t('prot.disputeCategory')} value={t(`prot.disputeCat.${dispute.category}` as TranslationKey)} />
          <p className="rounded-lg bg-background/60 p-2 text-[12px] leading-relaxed text-foreground">{dispute.description}</p>
          {dispute.evidence && <EvidenceChips orderId={order.id} evidenceJson={dispute.evidence} />}

          {/* Thread */}
          {(dispute.messages?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3 w-3" />{t('prot.disputeThread')}
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg bg-background/60 p-2">
                {dispute.messages!.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border/40 p-2">
                    <div className="flex items-center gap-1.5">
                      <RoleChip role={m.senderRole} />
                      <span className="text-[10px] text-muted-foreground" dir="ltr">
                        {new Date(m.createdAt).toLocaleString('en-GB', { hour12: true })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">{m.text}</p>
                    {m.attachments && <div className="mt-1.5"><EvidenceChips orderId={order.id} evidenceJson={m.attachments} /></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dispute.resolution && (
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {t('prot.disputeResolution')} {dispute.outcome ? `— ${t(`prot.disputeOutcome.${dispute.outcome}` as TranslationKey)}` : ''}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-foreground">{dispute.resolution}</p>
            </div>
          )}

          {threadOpen && (
            <div className="flex items-end gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('prot.disputeMessagePh')}
                rows={2}
                maxLength={2000}
                className="min-h-0 flex-1 rounded-lg bg-background/70 text-[12px]"
              />
              <Button size="sm" onClick={sendMessage} disabled={sending || !message.trim()} className="h-9 gap-1.5 rounded-lg text-[12px] font-semibold">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {t('prot.disputeSend')}
              </Button>
            </div>
          )}
          {dispute && !threadOpen && <p className="text-[10px] text-muted-foreground">{t('prot.disputeClosed')}</p>}
        </div>
      )}
    </div>
  );
}
