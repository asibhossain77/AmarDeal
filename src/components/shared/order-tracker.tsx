'use client';

import { Check, Copy, Truck, PackageCheck, Loader2, XCircle, FileText } from 'lucide-react';
import { useT, type TranslationKey } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { formatOrderDateTime } from './order-utils';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   OrderTracker — the order progress stepper (Phase 5).

   Two pipelines, one component:
   - physical: Placed → Confirmed → Processing → Shipped →
               Out for Delivery → Delivered → Completed
   - digital:  Placed → Confirmed → Processing → Delivered

   Pure display — every state shown comes from real DB values the
   detail API already authorized the viewer to see. Terminal failure
   states (cancelled / refunded / failed / disputed / partial) render
   a compact banner instead of the stepper.

   Timestamps come from the order's event history (toStatus → first
   event of that status), so each reached step can show WHEN it
   happened — the timestamped status history the spec asks for.
   ═══════════════════════════════════════════════════════════════ */

export interface TrackerEvent {
  toStatus: string | null;
  createdAt: string;
}

export interface OrderTrackerProps {
  status: string;
  paymentStatus: string;
  itemType?: string | null;
  orderNumber?: string;
  createdAt?: string;
  estimatedDeliveryDate?: string | null;
  events?: TrackerEvent[];
  className?: string;
}

const PHYSICAL_STEPS = [
  { key: 'pending_payment', label: 'orders.track.placed' },
  { key: 'queued', label: 'orders.track.confirmed' },
  { key: 'processing', label: 'orders.track.processing' },
  { key: 'shipped', label: 'orders.track.shipped' },
  { key: 'out_for_delivery', label: 'orders.track.outForDelivery' },
  { key: 'delivered', label: 'orders.track.delivered' },
  { key: 'completed', label: 'orders.track.completed' },
] as const;

const DIGITAL_STEPS = [
  { key: 'pending_payment', label: 'orders.track.placed' },
  { key: 'queued', label: 'orders.track.confirmed' },
  { key: 'processing', label: 'orders.track.processing' },
  { key: 'delivered', label: 'orders.track.delivered' },
] as const;

const TERMINAL_BAD: Record<string, { label: string; tone: string }> = {
  cancelled: { label: 'orderStatus.cancelled', tone: 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-400' },
  refunded: { label: 'orderStatus.refunded', tone: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400' },
  failed: { label: 'orderStatus.failed', tone: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400' },
  disputed: { label: 'orderStatus.disputed', tone: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400' },
  partial: { label: 'orderStatus.partial', tone: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400' },
};

/** Index of the furthest step the order has reached; -1 when unknown */
function stepIndex(status: string, keys: readonly { key: string }[]): number {
  return keys.findIndex((s) => s.key === status);
}

/** First event timestamp per reached status — order-event → step date */
function eventDates(events: TrackerEvent[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!events) return map;
  for (const e of events) {
    if (e.toStatus && !map.has(e.toStatus)) map.set(e.toStatus, e.createdAt);
  }
  return map;
}

export function OrderTracker({ status, paymentStatus, itemType, estimatedDeliveryDate, events, className }: OrderTrackerProps) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const isPhysical = itemType === 'physical';
  const steps = isPhysical ? PHYSICAL_STEPS : DIGITAL_STEPS;
  const currentIdx = stepIndex(status, steps);
  const dates = eventDates(events);

  // Terminal failure / side state → banner instead of stepper
  if (TERMINAL_BAD[status]) {
    const bad = TERMINAL_BAD[status];
    return (
      <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 ${bad.tone} ${className ?? ''}`} role="status">
        <XCircle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="text-[12px] font-semibold">{t(bad.label as never)}</p>
      </div>
    );
  }

  if (currentIdx < 0) return null;

  const showEta = (status === 'shipped' || status === 'out_for_delivery') && !!estimatedDeliveryDate;

  return (
    <div className={className} role="status" aria-label={t('orders.track.title' as never)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('orders.track.title' as never)}</p>
        {showEta && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            <Truck className="h-3 w-3" aria-hidden />
            {t('orders.track.eta' as never)}: {formatOrderDateTime(estimatedDeliveryDate!, locale)}
          </span>
        )}
        {status === 'delivered' && !isPhysical && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <FileText className="h-3 w-3" aria-hidden />
            {t('orders.track.digitalReady' as never)}
          </span>
        )}
      </div>

      <ol className="mt-3">
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isLast = i === steps.length - 1;
          const ts = dates.get(step.key);
          return (
            <li key={step.key} className="relative flex gap-3 pb-3 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[9px] top-5 h-full w-[2px] rounded ${done ? 'bg-primary/60' : 'bg-border'}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                      ? paymentStatus === 'paid'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-amber-500 bg-amber-500/10 text-amber-600'
                      : 'border-border bg-muted text-muted-foreground/40'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                ) : isCurrent ? (
                  paymentStatus === 'paid' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  )
                ) : (
                  <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1 -mt-0.5">
                <p className={`text-[12px] leading-5 ${isCurrent ? 'font-bold text-foreground' : done ? 'font-medium text-foreground/80' : 'text-muted-foreground'}`}>
                  {t(step.label as TranslationKey)}
                  {isCurrent && paymentStatus !== 'paid' && (
                    <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">
                      · {t('orderPayment.awaiting_verification')}
                    </span>
                  )}
                </p>
                {done && ts && (
                  <p className="text-[10px] text-muted-foreground" dir="ltr">{formatOrderDateTime(ts, locale)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Compact horizontal variant for list rows / dialog headers */
export function OrderTrackerBar({ status, itemType }: { status: string; itemType?: string | null }) {
  const t = useT();
  const steps = itemType === 'physical' ? PHYSICAL_STEPS : DIGITAL_STEPS;
  const currentIdx = stepIndex(status, steps);
  if (currentIdx < 0) return null;
  return (
    <div className="flex items-center gap-1" aria-label={t('orders.track.title' as never)}>
      {steps.map((s, i) => (
        <span
          key={s.key}
          title={t(s.label as never)}
          className={`h-1.5 flex-1 rounded-full ${i <= currentIdx ? 'bg-primary' : 'bg-border'}`}
          aria-hidden
        />
      ))}
      <span className="ml-1.5 shrink-0 text-[10px] font-semibold text-muted-foreground">
        {currentIdx + 1}/{steps.length}
      </span>
    </div>
  );
}

/** Copy-to-clipboard row used by tracking number + digital content blocks */
export function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success(t('orderDetail.copied')), () => {})}
        className="group flex min-w-0 items-center gap-1.5 text-right text-[13px] font-semibold text-foreground hover:text-primary"
        aria-label={`${label}: ${value} — copy`}
      >
        <span className={`truncate ${mono ? 'font-mono text-[12px]' : ''}`} dir="ltr">{value}</span>
        <Copy className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
      </button>
    </div>
  );
}

/** Icon helper re-exported for panels that show a delivery block header */
export { PackageCheck as DeliveryIcon };
