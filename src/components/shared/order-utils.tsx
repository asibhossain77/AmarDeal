'use client';

import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';

/* ═══════════════════════════════════════════════════════════════
   Shared Marketplace-order UI primitives — used by the seller
   Orders page, the buyer My Orders panel and the admin panel.
   One source of truth for status labels + badge styling so all
   three surfaces stay visually consistent (Midman design system:
   subtle borders, soft tints, no neon).
   ═══════════════════════════════════════════════════════════════ */

export interface OrderLite {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  quantity: number;
  unitPriceAtOrder: number;
  totalAmount: number;
  isPlatformOwned?: boolean;
  createdAt: string;
  optionName?: string | null;
  product: { id: string; title: string; image: string | null; category?: string; hasFile?: boolean };
  counterparty?: { id: string; name: string; imageLink: string | null } | null;
  /** present on the admin API response (both sides) */
  buyer?: { id: string; name: string; imageLink: string | null } | null;
  seller?: { id: string; name: string; imageLink: string | null } | null;
}

export interface OrderCounts {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  cancelled: number;
  refunded: number;
}

/** t() key per order status — shared vocabulary with the SMM order system */
export function orderStatusLabelKey(status: string): string {
  return `orderStatus.${status}`;
}

/** t() key per payment status — shared vocabulary with the SMM order system */
export function paymentStatusLabelKey(paymentStatus: string): string {
  return `orderPayment.${paymentStatus}`;
}

const STATUS_BADGE: Record<string, string> = {
  pending_payment: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0',
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0',
  processing: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 border-0',
  in_progress: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 border-0',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0',
  partial: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0',
  cancelled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-0',
  refunded: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-0',
};

const PAYMENT_BADGE: Record<string, string> = {
  unpaid: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-300 border-0',
  awaiting_verification: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-0',
};

export function OrderStatusBadge({ status }: { status: string }) {
  const t = useT();
  return (
    <Badge className={`text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE[status] ?? ''}`} variant="secondary">
      {t(orderStatusLabelKey(status) as never)}
    </Badge>
  );
}

export function PaymentStatusBadge({ paymentStatus }: { paymentStatus: string }) {
  const t = useT();
  return (
    <Badge className={`text-[11px] font-semibold whitespace-nowrap ${PAYMENT_BADGE[paymentStatus] ?? ''}`} variant="secondary">
      {t(paymentStatusLabelKey(paymentStatus) as never)}
    </Badge>
  );
}

/** ৳ with English digits — matches dashboard formatting */
export function formatTaka(amount: number): string {
  const rounded = Math.round(amount);
  return '৳' + rounded.toLocaleString('en');
}

/** Locale-aware date (English digits, site convention) */
export function formatOrderDate(iso: string, locale: 'bn' | 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Date + time for detail views */
export function formatOrderDateTime(iso: string | null | undefined, locale: 'bn' | 'en'): string {
  if (!iso) return null as unknown as string;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Product thumbnail with graceful placeholder (marketplace pattern) */
export function OrderProductThumb({ image, title, size = 'md' }: { image: string | null; title: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl';
  const url = cdnUrl(image);
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        className={`${dim} shrink-0 border border-border/40 bg-white object-cover`}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`${dim} flex shrink-0 items-center justify-center bg-muted/50 border border-border/40`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 text-muted-foreground/50">
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    </div>
  );
}

/** Counterparty avatar with initial fallback (Task 58 pattern) */
export function CounterpartyAvatar({ name, imageLink, size = 28 }: { name: string | null | undefined; imageLink?: string | null; size?: number }) {
  const initial = (name || '?').charAt(0);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[11px] font-bold text-primary"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {imageLink ? (
        <img src={cdnUrl(imageLink) || ''} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        initial
      )}
    </span>
  );
}
