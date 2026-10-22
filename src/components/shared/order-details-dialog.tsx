'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, ShieldCheck, ShieldAlert, RotateCcw, ExternalLink, FileDown, Play } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  OrderStatusBadge, PaymentStatusBadge, OrderProductThumb,
  CounterpartyAvatar, formatTaka, formatOrderDate, formatOrderDateTime,
} from './order-utils';

/* ═══════════════════════════════════════════════════════════════
   OrderDetailsDialog — shared compact order details panel.

   Used by the seller Orders page, the buyer My Orders panel and
   the admin Marketplace Orders panel. Renders real database values
   only, and offers the actions that are valid for the viewer's
   role + the order's current state (server re-validates anyway).
   ═══════════════════════════════════════════════════════════════ */

export interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  quantity: number;
  unitPriceAtOrder: number;
  totalAmount: number;
  customerNote: string | null;
  linkUrl: string | null;
  isPlatformOwned: boolean;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy?: string | null;
  cancelReason: string | null;
  refundedAt: string | null;
  // ── Phase 3: physical delivery info + dispute context ──
  delivery?: {
    buyerName: string | null;
    buyerPhone: string | null;
    addressLine: string | null;
    city: string | null;
    postalCode: string | null;
    deliveryNote: string | null;
  } | null;
  disputeReason?: string | null;
  disputedAt?: string | null;
  viewerRole: 'buyer' | 'seller' | 'admin';
  product: {
    id: string; title: string; image: string | null; category?: string;
    description?: string; hasFile?: boolean; fileName?: string | null; fileSize?: number | null;
    itemType?: string;
  } | null;
  option: { id: string; name: string; price: number } | null;
  buyer: { id: string; name: string; imageLink: string | null };
  seller: { id: string; name: string; imageLink: string | null; whatsappNumber?: string | null } | null;
  payment: {
    method: { id: string; name: string; accountNumber: string; accountType: string } | null;
    senderNumber: string | null;
    transactionId: string | null;
  };
}

export type OrderDialogAction = 'start' | 'complete' | 'cancel' | 'refund' | 'verify_payment' | 'pay_now' | 'dispute' | 'resolve_complete' | 'resolve_cancel';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[13px] font-medium text-foreground break-words">{children}</span>
    </div>
  );
}

export function OrderDetailsDialog({
  open,
  onOpenChange,
  order,
  busy,
  onAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: OrderDetailData | null;
  busy?: boolean;
  onAction: (action: OrderDialogAction, reason?: string) => Promise<void> | void;
}) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const [confirmAction, setConfirmAction] = useState<OrderDialogAction | null>(null);
  const [reason, setReason] = useState('');

  if (!order) return null;

  const role = order.viewerRole;
  const product = order.product;

  const canCancel = role !== 'admin' && order.status === 'pending_payment' && order.paymentStatus === 'unpaid';
  const canStart = (role === 'seller' || role === 'admin') && order.status === 'queued' && order.paymentStatus === 'paid';
  const canComplete = (role === 'seller' || role === 'admin') && order.status === 'processing' && order.paymentStatus === 'paid';
  const canVerify = role === 'admin' && order.status === 'pending_payment' && order.paymentStatus === 'awaiting_verification';
  const canRefund = role === 'admin' && order.paymentStatus === 'paid' && (order.status === 'processing' || order.status === 'completed' || order.status === 'queued' || order.status === 'in_progress');
  const canPay = role === 'buyer' && order.status === 'pending_payment' && order.paymentStatus === 'unpaid';
  // Phase 3: buyer may dispute a PAID order while it is being fulfilled;
  // only admin resolves disputes.
  const canDispute = role === 'buyer' && order.paymentStatus === 'paid'
    && (order.status === 'queued' || order.status === 'processing' || order.status === 'in_progress');
  const canResolveComplete = role === 'admin' && order.status === 'disputed';
  const canResolveCancel = role === 'admin' && order.status === 'disputed';

  const hasAnyAction = canCancel || canStart || canComplete || canVerify || canRefund || canPay || canDispute || canResolveComplete || canResolveCancel;

  const closeConfirm = () => { setConfirmAction(null); setReason(''); };

  const runAction = async () => {
    const action = confirmAction;
    closeConfirm();
    if (!action) return;
    await onAction(action, reason.trim() || undefined);
  };

  const confirmCopy: Record<string, { title: string; desc: string; withReason?: boolean }> = {
    cancel: { title: t('orders.confirmCancelTitle'), desc: t('orders.confirmCancelDesc'), withReason: true },
    start: { title: t('orders.confirmStartTitle'), desc: t('orders.confirmStartDesc') },
    complete: { title: t('orders.confirmCompleteTitle'), desc: t('orders.confirmCompleteDesc') },
    verify_payment: { title: t('orders.confirmVerifyTitle'), desc: t('orders.confirmVerifyDesc') },
    refund: { title: t('orders.confirmRefundTitle'), desc: t('orders.confirmRefundDesc'), withReason: true },
    pay_now: { title: t('orders.submitPayment'), desc: t('orders.paymentVerifyNote') },
    dispute: { title: t('orders.confirmDisputeTitle'), desc: t('orders.confirmDisputeDesc'), withReason: true },
    resolve_complete: { title: t('orders.confirmResolveCompleteTitle'), desc: t('orders.confirmResolveCompleteDesc') },
    resolve_cancel: { title: t('orders.confirmResolveCancelTitle'), desc: t('orders.confirmResolveCancelDesc'), withReason: true },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border/50 px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-mono text-[15px] font-bold tracking-tight">{order.orderNumber}</DialogTitle>
            {order.isPlatformOwned && (
              <Badge variant="secondary" className="border-0 bg-primary/10 text-[10px] font-bold text-primary">
                {t('orders.platformChip')}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-[12px] text-muted-foreground">
            {t('orders.detailsPlacedOn')} {formatOrderDate(order.createdAt, locale)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {/* Status summary */}
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge paymentStatus={order.paymentStatus} />
          </div>

          {/* Product */}
          {product && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            <OrderProductThumb image={product.image} title={product.title} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-semibold text-foreground">{product.title}</p>
              {order.option && (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {order.option.name} · {formatTaka(order.option.price)}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>{t('orders.colQty')}: {order.quantity}</span>
                <span>{t('orders.detailsUnitPrice')}: {formatTaka(order.unitPriceAtOrder)}</span>
              </div>
              {product.hasFile && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary">
                  <FileDown className="h-3 w-3" />
                  {product.fileName || t('marketplace.digitalProduct')}
                  {product.fileSize ? ` · ${formatBytes(product.fileSize)}` : ''}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-extrabold text-primary">{formatTaka(order.totalAmount)}</p>
            </div>
          </div>
          )}

          {/* Counterparty */}
          <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            {role === 'buyer' ? (
              <div className="flex items-center gap-2.5">
                <CounterpartyAvatar name={order.seller?.name} imageLink={order.seller?.imageLink} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">{order.seller?.name || '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{t('marketplace.seller')}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <CounterpartyAvatar name={order.buyer?.name} imageLink={order.buyer?.imageLink} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">{order.buyer?.name || '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{t('orders.colCustomer')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Phase 3: physical delivery info — buyer-supplied, auth-gated by the detail API */}
          {order.delivery && order.product?.itemType === 'physical' && (
            <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('orders.deliveryInfo')}</p>
              <div className="mt-1.5 space-y-1 text-[13px]">
                <p className="font-semibold text-foreground">{order.delivery.buyerName || '—'}</p>
                {order.delivery.buyerPhone && (
                  <p className="text-muted-foreground" dir="ltr">{t('orders.deliveryPhone')}: {order.delivery.buyerPhone}</p>
                )}
                <p className="text-muted-foreground">{t('orders.deliveryAddress')}: {[order.delivery.addressLine, order.delivery.city, order.delivery.postalCode].filter(Boolean).join(', ') || '—'}</p>
                {order.delivery.deliveryNote && (
                  <p className="text-muted-foreground">{t('orders.deliveryNote')}: {order.delivery.deliveryNote}</p>
                )}
              </div>
            </div>
          )}

          {/* Phase 3: dispute context */}
          {order.status === 'disputed' && order.disputeReason && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">{t('orders.disputeReasonLabel')}</p>
              <p className="mt-1 text-[13px] text-red-700 dark:text-red-300">{order.disputeReason}</p>
            </div>
          )}

          <Separator className="my-3" />

          {/* Timeline + fulfillment data — real DB values only */}
          <div className="divide-y divide-border/30">
            <DetailRow label={t('orders.colPayment')}>
              <PaymentStatusBadge paymentStatus={order.paymentStatus} />
            </DetailRow>
            {order.payment.method && (
              <DetailRow label={t('orders.detailsMethod')}>
                {order.payment.method.name} — {order.payment.method.accountNumber}
              </DetailRow>
            )}
            {order.payment.senderNumber && (
              <DetailRow label={t('orders.detailsSender')}>{order.payment.senderNumber}</DetailRow>
            )}
            {order.payment.transactionId && (
              <DetailRow label={t('orders.detailsTxn')}>
                <span className="font-mono text-[12px]">{order.payment.transactionId}</span>
              </DetailRow>
            )}
            {order.paidAt && (
              <DetailRow label={t('orders.detailsPaidOn')}>{formatOrderDateTime(order.paidAt, locale)}</DetailRow>
            )}
            {order.completedAt && (
              <DetailRow label={t('orders.detailsCompletedOn')}>{formatOrderDateTime(order.completedAt, locale)}</DetailRow>
            )}
            {order.cancelledAt && (
              <DetailRow label={t('orders.detailsCancelledOn')}>{formatOrderDateTime(order.cancelledAt, locale)}</DetailRow>
            )}
            {order.refundedAt && (
              <DetailRow label={t('orders.detailsRefundedOn')}>{formatOrderDateTime(order.refundedAt, locale)}</DetailRow>
            )}
            {order.cancelReason && (
              <DetailRow label={t('orders.detailsCancelReason')}>{order.cancelReason}</DetailRow>
            )}
            {order.linkUrl && (
              <DetailRow label={t('orders.detailsTargetLink')}>
                <a
                  href={order.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-[220px] items-center gap-1 truncate font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{order.linkUrl}</span>
                </a>
              </DetailRow>
            )}
          </div>

          {order.customerNote && (
            <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('orders.detailsNote')}</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{order.customerNote}</p>
            </div>
          )}
        </div>

        {/* Actions — only valid transitions are offered */}
        {hasAnyAction && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 bg-muted/20 px-5 py-3.5">
            {canPay && (
              <Button size="sm" onClick={() => onAction('pay_now')} disabled={busy} className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold">
                {t('orders.submitPayment')}
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => setConfirmAction('cancel')} disabled={busy}
                className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                {t('orders.cancelOrder')}
              </Button>
            )}
            {canVerify && (
              <Button size="sm" onClick={() => setConfirmAction('verify_payment')} disabled={busy} className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('orders.verifyPayment')}
              </Button>
            )}
            {canStart && (
              <Button size="sm" variant="outline" onClick={() => setConfirmAction('start')} disabled={busy} className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold">
                <Play className="h-3.5 w-3.5" />
                {t('orders.startProcessing')}
              </Button>
            )}
            {canComplete && (
              <Button size="sm" onClick={() => setConfirmAction('complete')} disabled={busy} className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('orders.markCompleted')}
              </Button>
            )}
            {canRefund && (
              <Button size="sm" variant="outline" onClick={() => setConfirmAction('refund')} disabled={busy}
                className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400">
                <RotateCcw className="h-3.5 w-3.5" />
                {t('orders.refundOrder')}
              </Button>
            )}
            {canDispute && (
              <Button size="sm" variant="outline" onClick={() => setConfirmAction('dispute')} disabled={busy}
                className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                {t('orders.openDispute')}
              </Button>
            )}
            {canResolveComplete && (
              <Button size="sm" onClick={() => setConfirmAction('resolve_complete')} disabled={busy}
                className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('orders.resolveComplete')}
              </Button>
            )}
            {canResolveCancel && (
              <Button size="sm" variant="outline" onClick={() => setConfirmAction('resolve_cancel')} disabled={busy}
                className="h-9 gap-1.5 rounded-lg text-[13px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                {t('orders.resolveCancel')}
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      {/* Confirmation (cancel / complete / verify / refund) */}
      <AlertDialog open={!!confirmAction} onOpenChange={(v) => { if (!v) closeConfirm(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction ? confirmCopy[confirmAction].title : ''}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction ? confirmCopy[confirmAction].desc : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmAction && confirmCopy[confirmAction].withReason && (
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('orders.reasonOptional')}
              rows={3}
              maxLength={500}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeConfirm}>{t('marketplace.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runAction(); }}
              disabled={busy}
              className={cn(confirmAction === 'cancel' && 'bg-destructive text-white hover:bg-destructive/90')}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('orders.confirmYes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

