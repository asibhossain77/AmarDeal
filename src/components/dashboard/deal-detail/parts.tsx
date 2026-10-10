'use client';

/**
 * Deal Detail — Shared presentational parts
 *
 * Design system (per redesign spec):
 *  - Midman green (var(--primary)) as the only accent
 *  - White / light-gray surfaces, thin neutral borders, subtle shadows
 *  - Lucide icons only, English digits for IDs / dates / amounts
 *  - No emojis, no glassmorphism, no decorative gradients
 *
 * URL safety: all text rendering goes through the shared LinkifyText
 * component (safe-by-construction, URL-API validated).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { LinkifyText } from '@/components/ui/linkify-text';
import { cdnUrl } from '@/lib/cdn-url';
import { toBn } from '@/components/dashboard/work-deadline';
import {
  FileCheck,
  Send,
  ShieldCheck,
  Truck,
  ThumbsUp,
  Check,
  AlertTriangle,
  Ban,
  Clock,
  Shield,
  Receipt,
  ShoppingBag,
  Store,
  Bot,
  ChevronDown,
  History,
  FileText,
  Wallet,
  XCircle,
  Headphones,
  CircleCheckBig,
  MessageCircle,
  Download,
  File,
  FileText as FileTextIcon,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileX,
} from 'lucide-react';
import type { DealStatus } from '@/lib/store';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

/** Attachment metadata as returned by the chat API (key never reaches the client) */
export interface ChatFileMeta {
  fileName: string;
  fileSize?: number;
  fileType?: string | null;
}

export interface DealData {
  id: string;
  title: string;
  amount: number;
  status: DealStatus;
  terms?: string | null;
  createdAt: string;
  buyerId: string;
  sellerId?: string | null;
  creatorId: string;
  paymentMethodId?: string | null;
  senderNumber?: string | null;
  transactionId?: string | null;
  paymentAmount?: number | null;
  platformFee?: number | null;
  rejectionReason?: string | null;
  adminCalled?: boolean | null;
  adminCalledAt?: string | null;
  /* Seller work-duration commitment (set after payment verification) */
  workDays?: number | null;
  workDeadlineAt?: string | null;
  /* Unresponsive-buyer auto-complete flow */
  deliveredAt?: string | null;
  updatedAt?: string | null;
  reminderEmailSentAt?: string | null;
  autoCompleteAt?: string | null;
  buyer: { id: string; name: string; email: string; phone: string; imageLink?: string | null } | null;
  seller: { id: string; name: string; email: string; phone: string; imageLink?: string | null } | null;
  creator: { id: string; name: string; email: string } | null;
  paymentMethod?: { id: string; name: string; accountType: string } | null;
  /* Digital product attached to this deal (fileName presence ⇒ downloadable) */
  product?: { id: string; title: string; fileName?: string | null; fileSize?: number | null; isFree?: boolean } | null;
}

export type MessageRole = 'buyer' | 'seller' | 'admin' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  senderId: string;
  senderName: string;
  text: string;
  /** Display time (HH:MM, English digits) */
  timestamp: string;
  /** Raw ISO timestamp — used for day dividers */
  timestampISO: string;
  file?: ChatFileMeta | null;
  fileExpired?: boolean;
}

/** Convert ISO date string to display time (English digits) */
export function toBnTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Convert DB message to ChatMessage */
export function dbToChatMsg(m: { id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string; file?: ChatFileMeta | null; fileExpired?: boolean }): ChatMessage {
  return {
    id: m.id,
    role: (m.role as MessageRole) || 'system',
    senderId: m.senderId,
    senderName: m.senderName || 'অজানা',
    text: m.text,
    timestamp: toBnTime(m.createdAt),
    timestampISO: m.createdAt,
    file: m.file || null,
    fileExpired: !!m.fileExpired,
  };
}

/* ═══════════════════════════════════════════════════════════
   Chat attachment helpers (shared with the main tracker)
   ═══════════════════════════════════════════════════════════ */

export const CHAT_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.jpg,.jpeg,.png,.webp,.gif';
export const CHAT_FILE_MAX_BYTES = 4 * 1024 * 1024; // 4MB (Vercel body limit)

/** Format bytes → short human readable size */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pick the right icon for a chat attachment */
export function ChatFileIcon({ fileType, fileName, className }: { fileType?: string | null; fileName: string; className?: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  let Icon = File;
  if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) Icon = FileImage;
  else if (ext === 'pdf' || ['doc', 'docx', 'ppt', 'pptx'].includes(ext)) Icon = FileTextIcon;
  else if (['xls', 'xlsx', 'csv'].includes(ext)) Icon = FileSpreadsheet;
  else if (['zip', 'rar'].includes(ext)) Icon = FileArchive;
  return <Icon className={className} />;
}

/** True when the attachment is an image (rendered inline) */
export function isImageFile(fileType?: string | null, fileName?: string): boolean {
  if (fileType?.startsWith('image/')) return true;
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
}

/* ═══════════════════════════════════════════════════════════
   Formatting helpers
   ═══════════════════════════════════════════════════════════ */

/** Format number with ৳ prefix (English digits) */
export function formatTaka(amount: number): string {
  return '৳' + Math.round(amount).toLocaleString('en');
}

/** Formatted creation date, e.g. "Jan 5, 2025" */
export function formatDealDate(iso?: string | null): string {
  if (!iso) return '---';
  try {
    return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '---';
  }
}

/** Date + time for activity entries */
function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Chat day divider label: আজ / গতকাল / otherwise "Jan 5, 2025" */
export function formatChatDayLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'আজ';
    if (sameDay(d, yesterday)) return 'গতকাল';
    return d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/* ═══════════════════════════════════════════════════════════
   Status mapping (single source of truth = backend deal.status)
   ═══════════════════════════════════════════════════════════ */

/** 5-step escrow progress — labels per redesign spec */
export const STEPS = [
  { num: '1', label: 'Deal তৈরি', icon: FileCheck, statusKey: 'created' as const },
  { num: '2', label: 'পেমেন্ট', icon: Send, statusKey: 'payment_pending' as const },
  { num: '3', label: 'পেমেন্ট যাচাই', icon: ShieldCheck, statusKey: 'payment_verified' as const },
  { num: '4', label: 'ডেলিভারি', icon: Truck, statusKey: 'in_delivery' as const },
  { num: '5', label: 'Deal সম্পন্ন', icon: ThumbsUp, statusKey: 'completed' as const },
];

/**
 * Maps a deal status to the active step index.
 * -1 means no steps are active (cancelled/rejected).
 */
export function statusToActiveStep(status: string): number {
  switch (status) {
    case 'created': return 0;
    case 'payment_pending': return 1;
    case 'payment_verified': return 2;
    case 'in_delivery': return 3;
    case 'completed': return 4;
    case 'cancelled':
    case 'rejected': return -1;
    case 'disputed': return 3;
    default: return 0;
  }
}

/** Bangla status label */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'created': return 'তৈরি হয়েছে';
    case 'payment_pending': return 'পেমেন্ট পেন্ডিং';
    case 'payment_verified': return 'ভেরিফাইড';
    case 'in_delivery': return 'ডেলিভারি চলছে';
    case 'completed': return 'সম্পন্ন';
    case 'cancelled': return 'বাতিল';
    case 'disputed': return 'বিরোধ চলছে';
    case 'rejected': return 'রিজেক্টেড';
    default: return status;
  }
}

/** Status badge — color mapping preserved from the original UI */
export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'created':
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 font-medium">তৈরি হয়েছে</Badge>;
    case 'payment_pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">পেমেন্ট পেন্ডিং</Badge>;
    case 'payment_verified':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium">ভেরিফাইড</Badge>;
    case 'in_delivery':
      return <Badge className="bg-primary/15 text-primary dark:bg-primary/20 border-0 font-medium">ডেলিভারি চলছে</Badge>;
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium">সম্পন্ন</Badge>;
    case 'cancelled':
      return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0 font-medium">বাতিল</Badge>;
    case 'disputed':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">বিরোধ চলছে</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">রিজেক্টেড</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/* ═══════════════════════════════════════════════════════════
   Progress tracker
   ═══════════════════════════════════════════════════════════ */

/**
 * 5-step escrow progress tracker.
 *  - Completed steps: green with a check
 *  - Current step: highlighted (red tint when disputed)
 *  - Upcoming steps: neutral gray
 *  - Mobile: compact horizontal · md+: full horizontal with icons
 */
export function DealStepper({ activeStep, isDisputed, isCancelled }: { activeStep: number; isDisputed: boolean; isCancelled: boolean }) {
  if (isCancelled) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-5 py-3.5 border border-red-200 dark:border-red-500/20">
          <Ban className="h-7 w-7 text-red-500 shrink-0" />
          <div>
            <p className="text-sm md:text-base font-bold text-red-700 dark:text-red-400">ডিল বাতিল হয়েছে</p>
            <p className="text-xs md:text-sm text-red-600/70 dark:text-red-400/70">এই ডিল আর সক্রিয় নয়</p>
          </div>
        </div>
      </div>
    );
  }

  const accent = isDisputed ? '#EF4444' : 'var(--primary)';

  const circleStyle = (isCompleted: boolean, isActive: boolean) => ({
    backgroundColor: isCompleted || isActive ? (isDisputed && isActive ? '#FEE2E2' : accent) : 'var(--background)',
    borderColor: isCompleted || isActive ? (isDisputed && isActive ? '#EF4444' : accent) : 'var(--border)',
    color: isCompleted ? '#fff' : isActive && isDisputed ? '#EF4444' : isActive ? '#fff' : 'var(--muted-foreground)',
  });

  return (
    <div>
      {/* ── Mobile: compact horizontal ── */}
      <div className="md:hidden">
        <div className="flex items-start">
          {STEPS.map((step, i) => {
            const isCompleted = i < activeStep;
            const isActive = i === activeStep;
            const isLast = i === STEPS.length - 1;
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex items-start flex-1 min-w-0 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-300"
                    style={circleStyle(isCompleted, isActive)}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : isActive && isDisputed ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className="max-w-[64px] text-center text-[10px] font-medium leading-tight"
                    style={{ color: isCompleted || isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                  >
                    {step.label}
                  </span>
                </div>
                {!isLast && (
                  <div className="mt-[17px] mx-1 h-[3px] flex-1 min-w-2 rounded-full" style={{ backgroundColor: isCompleted ? accent : 'var(--border)' }} />
                )}
              </div>
            );
          })}
        </div>
        {/* Current step hint */}
        <div className="mt-3 flex items-center justify-center">
          {isDisputed ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-500">
              <AlertTriangle className="h-3 w-3" /> বিরোধ দায়ের হয়েছে
            </span>
          ) : activeStep >= 0 && activeStep < STEPS.length - 1 ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              বর্তমান ধাপ: {STEPS[activeStep]?.label}
            </span>
          ) : activeStep === STEPS.length - 1 ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
              <CircleCheckBig className="h-3 w-3" /> Deal সম্পন্ন
            </span>
          ) : null}
        </div>
      </div>

      {/* ── md+: full horizontal tracker ── */}
      <div className="hidden md:block">
        <div className="relative flex items-start justify-between py-1">
          {/* Background track */}
          <div className="absolute top-[22px] left-[24px] right-[24px] h-[3px] rounded-full bg-border" />
          {/* Filled progress */}
          {activeStep >= 0 && (
            <div
              className="absolute top-[22px] left-[24px] h-[3px] rounded-full transition-all duration-500"
              style={{
                width: activeStep >= STEPS.length - 1 ? 'calc(100% - 48px)' : `calc(${(activeStep / (STEPS.length - 1)) * 100}% - 24px)`,
                backgroundColor: accent,
              }}
            />
          )}

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isCompleted = i < activeStep;
            const isActive = i === activeStep;
            return (
              <div key={step.num} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / STEPS.length}%` }}>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 bg-background transition-colors duration-300"
                  style={circleStyle(isCompleted, isActive)}
                >
                  {isCompleted ? (
                    <Check className="h-[18px] w-[18px]" strokeWidth={3} />
                  ) : isActive && isDisputed ? (
                    <AlertTriangle className="h-[18px] w-[18px]" />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" />
                  )}
                </div>
                <p
                  className="mt-2.5 text-center text-xs font-semibold leading-tight"
                  style={{ color: isCompleted || isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-center text-[10px] text-muted-foreground">
                  {isCompleted ? 'সম্পন্ন' : isActive ? (i === STEPS.length - 1 ? 'সম্পন্ন' : 'চলছে') : `ধাপ ${step.num}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Deal amount card
   ═══════════════════════════════════════════════════════════ */

/** Status-driven escrow note — never claims money is secured unless the backend confirms it */
function escrowNote(status: string): { icon: React.ElementType; text: string; className: string } {
  switch (status) {
    case 'created':
      return { icon: Clock, text: 'পেমেন্ট এখনো জমা হয়নি', className: 'text-muted-foreground' };
    case 'payment_pending':
      return { icon: Clock, text: 'পেমেন্ট জমা হয়েছে — যাচাই চলছে', className: 'text-amber-600 dark:text-amber-400' };
    case 'payment_verified':
    case 'in_delivery':
      return { icon: ShieldCheck, text: 'পেমেন্ট যাচাই হয়েছে — Midman এসক্রোতে সুরক্ষিত', className: 'text-emerald-600 dark:text-emerald-400' };
    case 'completed':
      return { icon: CircleCheckBig, text: 'লেনদেন সম্পন্ন হয়েছে', className: 'text-emerald-600 dark:text-emerald-400' };
    case 'disputed':
      return { icon: AlertTriangle, text: 'বিরোধ চলছে — অ্যাডমিন পর্যালোচনা করছেন', className: 'text-red-600 dark:text-red-400' };
    case 'rejected':
      return { icon: XCircle, text: 'পেমেন্ট রিজেক্ট হয়েছে', className: 'text-red-600 dark:text-red-400' };
    case 'cancelled':
      return { icon: XCircle, text: 'ডিল বাতিল হয়েছে', className: 'text-muted-foreground' };
    default:
      return { icon: Clock, text: '', className: 'text-muted-foreground' };
  }
}

export function DealAmountCard({ deal }: { deal: DealData | null; }) {
  const amount = deal?.amount ?? 0;
  const status = deal?.status || 'created';
  const note = escrowNote(status);
  const NoteIcon = note.icon;
  const showActual = deal?.paymentAmount != null && deal.paymentAmount !== deal.amount;
  const showFee = deal?.platformFee != null && deal.platformFee > 0;
  const hasRows = showActual || showFee || !!deal?.paymentMethod || deal?.workDays != null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deal Amount</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            ৳ {Math.round(amount).toLocaleString('en')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Shield className="h-3.5 w-3.5" />
          Midman সুরক্ষায়
        </span>
      </div>

      {note.text && (
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${note.className}`}>
          <NoteIcon className="h-3.5 w-3.5 shrink-0" />
          {note.text}
        </div>
      )}

      {hasRows && (
        <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
          {deal?.workDays != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">প্রতিশ্রুত কাজের সময়</span>
              <span className="font-semibold text-foreground">{toBn(deal.workDays)} দিন</span>
            </div>
          )}
          {showActual && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">প্রকৃত পেমেন্টের পরিমাণ</span>
              <span className="font-semibold text-foreground">{formatTaka(deal!.paymentAmount!)}</span>
            </div>
          )}
          {showFee && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" />
                প্ল্যাটফর্ম ফি
              </span>
              <span className="font-semibold text-foreground">{formatTaka(deal!.platformFee!)}</span>
            </div>
          )}
          {deal?.paymentMethod && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">পেমেন্ট মাধ্যম</span>
              <span className="font-semibold text-foreground">{deal.paymentMethod.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Buyer / Seller profile cards
   ═══════════════════════════════════════════════════════════ */

function PartyCard({
  name,
  role,
  avatar,
  isCurrentUser,
}: {
  name: string;
  role: 'buyer' | 'seller';
  avatar?: string | null;
  isCurrentUser: boolean;
}) {
  const isBuyer = role === 'buyer';
  const RoleIcon = isBuyer ? ShoppingBag : Store;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      {avatar ? (
        <img
          src={cdnUrl(avatar) || ''}
          alt={name}
          className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-border"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
          {name?.charAt(0) || (isBuyer ? 'ক' : 'ব')}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-foreground">{name}</p>
          {isCurrentUser && (
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">আপনি</span>
          )}
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <RoleIcon className="h-3.5 w-3.5" />
          {isBuyer ? 'ক্রেতা' : 'বিক্রেতা'}
        </span>
      </div>
    </div>
  );
}

export function PartyCards({
  deal,
  currentUserId,
  fallbackBuyerName,
  fallbackSellerName,
}: {
  deal: DealData | null;
  currentUserId?: string;
  fallbackBuyerName?: string;
  fallbackSellerName?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <PartyCard
        name={deal?.buyer?.name || fallbackBuyerName || 'ক্রেতা'}
        role="buyer"
        avatar={deal?.buyer?.imageLink}
        isCurrentUser={!!currentUserId && currentUserId === deal?.buyerId}
      />
      <PartyCard
        name={deal?.seller?.name || fallbackSellerName || 'বিক্রেতা'}
        role="seller"
        avatar={deal?.seller?.imageLink}
        isCurrentUser={!!currentUserId && currentUserId === deal?.sellerId}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Deal summary (compact info rows)
   ═══════════════════════════════════════════════════════════ */

export function DealSummaryCard({ deal, dealId }: { deal: DealData | null; dealId: string }) {
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Deal ID', value: `DL-${dealId.slice(-5)}`, mono: true },
    { label: 'তৈরির তারিখ', value: formatDealDate(deal?.createdAt) },
  ];
  if (deal?.creator?.name) rows.push({ label: 'তৈরি করেছেন', value: deal.creator.name });
  if (deal?.workDays != null) rows.push({ label: 'প্রতিশ্রুত সময়', value: `${toBn(deal.workDays)} দিন` });
  if (deal?.paymentMethod) rows.push({ label: 'পেমেন্ট মাধ্যম', value: deal.paymentMethod.name });
  if (deal?.platformFee != null && deal.platformFee > 0) rows.push({ label: 'প্ল্যাটফর্ম ফি', value: formatTaka(deal.platformFee) });
  if (deal?.paymentAmount != null && deal.paymentAmount !== deal.amount) rows.push({ label: 'প্রকৃত পেমেন্ট', value: formatTaka(deal.paymentAmount) });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ডিল সামারি</p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="shrink-0 text-muted-foreground">{row.label}</span>
            <span className={`min-w-0 truncate text-right font-semibold text-foreground ${row.mono ? 'font-mono text-xs' : ''}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Activity timeline — only backend-confirmed events
   ═══════════════════════════════════════════════════════════ */

export interface ActivityEvent {
  icon: React.ElementType;
  label: string;
  time?: string;
  tone?: 'default' | 'danger';
}

/** Builds the timeline strictly from real backend fields — no invented events or timestamps */
export function buildActivityEvents(deal: DealData | null): ActivityEvent[] {
  if (!deal) return [];
  const status = deal.status;
  const events: ActivityEvent[] = [];

  events.push({ icon: FileCheck, label: 'Deal তৈরি হয়েছে', time: formatDateTime(deal.createdAt) });

  const paymentSubmitted = !!deal.transactionId || deal.paymentAmount != null;
  if (paymentSubmitted) events.push({ icon: Wallet, label: 'পেমেন্ট জমা দেওয়া হয়েছে' });

  if (['payment_verified', 'in_delivery', 'completed'].includes(status) || status === 'disputed') {
    events.push({ icon: ShieldCheck, label: 'পেমেন্ট যাচাই হয়েছে' });
  }
  if (['in_delivery', 'completed'].includes(status) || status === 'disputed') {
    events.push({ icon: Truck, label: 'বিক্রেতা ডেলিভারি দিয়েছেন', time: formatDateTime(deal.deliveredAt) });
  }
  if (deal.adminCalled) {
    events.push({ icon: Headphones, label: 'অ্যাডমিনকে ডাকা হয়েছে', time: formatDateTime(deal.adminCalledAt) });
  }
  if (status === 'disputed') {
    events.push({ icon: AlertTriangle, label: 'বিরোধ দায়ের হয়েছে', tone: 'danger' });
  }
  if (status === 'completed') {
    events.push({ icon: ThumbsUp, label: 'ক্রেতা কাজ সম্পন্ন করেছেন' });
  }
  if (status === 'cancelled') {
    events.push({ icon: XCircle, label: 'ডিল বাতিল হয়েছে', tone: 'danger' });
  }
  if (status === 'rejected') {
    events.push({ icon: XCircle, label: 'পেমেন্ট রিজেক্ট হয়েছে', tone: 'danger' });
  }

  return events;
}

export function ActivityTimeline({ deal }: { deal: DealData | null }) {
  const events = buildActivityEvents(deal);
  if (events.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <History className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-foreground">ডিল আপডেট</h3>
      </div>
      <div className="relative space-y-0">
        {events.map((event, i) => {
          const Icon = event.icon;
          const isLast = i === events.length - 1;
          return (
            <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && <div className="absolute left-[11px] top-6 h-[calc(100%-16px)] w-px bg-border" />}
              <div
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background ${
                  event.tone === 'danger' ? 'border-red-200 dark:border-red-500/30' : 'border-border'
                }`}
              >
                <Icon className={`h-3 w-3 ${event.tone === 'danger' ? 'text-red-500' : 'text-primary'}`} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className={`text-[13px] font-medium leading-snug ${event.tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                  {event.label}
                </p>
                {event.time && <p className="mt-0.5 text-[11px] text-muted-foreground">{event.time}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Deal Terms — collapsible preview + full view
   ═══════════════════════════════════════════════════════════ */

/** Collapsible terms card for the Deal তথ্য tab */
export function TermsPreviewCard({ terms, onOpenFull }: { terms: string; onOpenFull?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = terms.trim().length > 140;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left sm:px-5"
        aria-expanded={expanded}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">Deal Terms</span>
          <span className="block text-[11px] text-muted-foreground">{expanded ? 'সম্পূর্ণ শর্তাবলী দেখানো হচ্ছে' : 'সংক্ষিপ্ত প্রিভিউ — বিস্তারিত দেখতে খুলুন'}</span>
        </span>
        {onOpenFull && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onOpenFull(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onOpenFull(); } }}
            className="hidden shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:inline-flex"
          >
            ট্যাবে দেখুন
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded ? (
        <div className="border-t border-border/50 px-4 py-4 sm:px-5">
          <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-foreground">
            <LinkifyText text={terms} />
          </p>
        </div>
      ) : (
        <div className="border-t border-border/50 px-4 py-3.5 sm:px-5">
          <p className={`text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line break-words ${isLong ? 'line-clamp-3' : ''}`}>
            {terms}
          </p>
        </div>
      )}
    </div>
  );
}

/** Full terms view for the Deal Terms tab */
export function TermsFullView({ terms }: { terms: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2.5 border-b border-border/50 pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <FileText className="h-[18px] w-[18px] text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Deal Terms</h3>
          <p className="text-[11px] text-muted-foreground">এই ডিলের সম্পূর্ণ শর্তাবলী</p>
        </div>
      </div>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
        <LinkifyText text={terms} />
      </p>
    </div>
  );
}

export function TermsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">কোনো শর্তাবলী নেই</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        এই ডিলে কোনো শর্তাবলী যোগ করা হয়নি। ডিল তৈরির সময় শর্তাবলী যোগ করা হলে এখানে দেখা যাবে।
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Status notice banners (payment & actions section)
   ═══════════════════════════════════════════════════════════ */

export function NoticeBanner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'green' | 'amber' | 'red' | 'neutral';
  icon: React.ElementType;
  title: string;
  children?: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400',
    neutral: 'bg-muted/50 dark:bg-zinc-800/40 border-border text-foreground',
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 sm:px-4 sm:py-3.5 ${tones[tone]}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold sm:text-[13px]">{title}</p>
        {children && <div className="mt-1 text-[11px] font-medium opacity-80 sm:text-xs">{children}</div>}
      </div>
    </div>
  );
}

/** Submitted payout / refund account details (real backend data) */
export function PayoutInfoBox({ info }: { info: { accountType: string; accountNumber: string; accountName: string } }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">জমা দেওয়া একাউন্ট তথ্য</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[10px] text-muted-foreground">পেমেন্ট মেথড</p>
          <p className="font-semibold text-foreground">{info.accountType}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">একাউন্ট নম্বর</p>
          <p className="font-mono font-semibold text-foreground">{info.accountNumber}</p>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-[10px] text-muted-foreground">একাউন্টের নাম</p>
        <p className="text-sm font-semibold text-foreground">{info.accountName}</p>
      </div>
    </div>
  );
}

/** Buyer's own submitted payment info (method / sender / txn id) */
export function PaymentSubmittedInfo({
  methodName,
  senderNumber,
  transactionId,
  paymentAmount,
}: {
  methodName?: string | null;
  senderNumber?: string | null;
  transactionId?: string | null;
  paymentAmount?: number | null;
}) {
  if (!senderNumber && !transactionId && paymentAmount == null) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">জমা দেওয়া পেমেন্টের তথ্য</p>
      <div className="mt-2 space-y-1.5 text-[13px]">
        {methodName && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">মাধ্যম</span>
            <span className="font-semibold text-foreground">{methodName}</span>
          </div>
        )}
        {paymentAmount != null && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">পরিমাণ</span>
            <span className="font-semibold text-foreground">{formatTaka(paymentAmount)}</span>
          </div>
        )}
        {senderNumber && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">প্রেরকের নম্বর</span>
            <span className="font-mono font-semibold text-foreground">{senderNumber}</span>
          </div>
        )}
        {transactionId && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">ট্রানজেকশন আইডি</span>
            <span className="font-mono font-semibold text-foreground">{transactionId}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Chat — bubbles & dividers
   ═══════════════════════════════════════════════════════════ */

export function ChatDateDivider({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/50" />
        <span className="rounded-full bg-muted/70 px-3 py-1 text-[10px] font-semibold text-muted-foreground">{text}</span>
        <div className="h-px flex-1 bg-border/50" />
      </div>
    </div>
  );
}

export function ChatBubble({ message, currentUserId, dealId }: { message: ChatMessage; currentUserId?: string; dealId?: string }) {
  const { role, senderName, text, timestamp, timestampISO } = message;

  /* ── System messages: centered, amber accent ── */
  if (role === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center py-1.5"
      >
        <div className="flex max-w-[92%] flex-col items-center gap-1.5 sm:max-w-[75%]">
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/10 px-4 py-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
              <Bot className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-200/90">
                <LinkifyText text={text} variant="amber" />
              </p>
              <p className="mt-1 text-[10px] text-amber-500/70 dark:text-amber-400/50">{timestampISO ? formatChatDayLabel(timestampISO) + ' · ' : ''}{timestamp}</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Admin messages: centered, violet accent ── */
  if (role === 'admin') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center py-1.5"
      >
        <div className="flex max-w-[92%] flex-col items-center gap-1 sm:max-w-[75%]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">Admin</span>
          </div>
          <div className="w-full rounded-2xl border border-violet-200/60 dark:border-violet-500/20 bg-violet-50/60 dark:bg-violet-500/10 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-violet-900 dark:text-violet-200">
              <LinkifyText text={text} variant="purple" />
            </p>
            <p className="mt-1 text-[10px] text-violet-500/70 dark:text-violet-400/50">{timestamp}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Buyer/Seller messages ── */
  const isOwn = !!currentUserId && message.senderId === currentUserId;

  /* ── Attachment state ── */
  const file = message.file || null;
  const expired = !!message.fileExpired;
  const fileUrl = file && dealId && !expired
    ? `/api/deals/${encodeURIComponent(dealId)}/chat/file/${message.id}`
    : null;
  const isImage = file && !expired && isImageFile(file.fileType, file.fileName);
  // File-only messages carry an auto fallback text ("📎 name") — hide it when the file card is shown
  const fallbackText = file ? `📎 ${file.fileName}` : null;
  const showCaption = !!text && text !== fallbackText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[11px] font-semibold text-muted-foreground">{senderName}</span>
          <span className="rounded bg-muted px-1 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            {role === 'buyer' ? 'ক্রেতা' : 'বিক্রেতা'}
          </span>
        </div>
        <div
          className={`rounded-2xl ${isOwn ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border/60 bg-card text-foreground'} ${file && isImage && !showCaption ? 'p-1.5' : 'px-3.5 py-2.5'}`}
        >
          {/* ── Attachment: inline image ── */}
          {file && isImage && fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl" aria-label={`${file.fileName} — বড় করে দেখুন`}>
              <img src={fileUrl} alt={file.fileName} loading="lazy" decoding="async" className="max-h-60 w-auto max-w-full rounded-xl" />
            </a>
          )}

          {/* ── Attachment: document download card ── */}
          {file && !isImage && !expired && (
            <a
              href={fileUrl || '#'}
              download
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${isOwn ? 'bg-white/15' : 'bg-muted/70'}`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOwn ? 'bg-white/25' : 'bg-primary text-primary-foreground'}`}>
                <ChatFileIcon fileType={file.fileType} fileName={file.fileName} className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 text-left">
                <p className="max-w-[180px] truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-[11px] opacity-70">
                  {formatFileSize(file.fileSize)} · ডাউনলোড করতে ক্লিক করুন
                </p>
              </div>
              <Download className="ml-1 h-4 w-4 shrink-0 opacity-80" />
            </a>
          )}

          {/* ── Attachment: expired placeholder (auto-deleted after 3 days) ── */}
          {file && expired && (
            <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${isOwn ? 'bg-white/10' : 'bg-muted/70'}`}>
              <FileX className="h-5 w-5 shrink-0 opacity-50" />
              <div className="min-w-0">
                <p className="max-w-[180px] truncate text-sm font-medium line-through opacity-60">{file.fileName}</p>
                <p className="text-[11px] opacity-60">৩ দিন পূর্ণ — ফাইলটি স্বয়ংক্রিয়ভাবে মুছে ফেলা হয়েছে</p>
              </div>
            </div>
          )}

          {/* ── Caption / plain text (URLs → safe clickable links) ── */}
          {showCaption && (
            <p className="text-sm leading-relaxed break-words">
              <LinkifyText text={text} variant={isOwn ? 'accent' : 'default'} />
            </p>
          )}
        </div>
        <span className="px-1 text-[10px] text-muted-foreground/70">{timestamp}</span>
      </div>
    </motion.div>
  );
}

export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <MessageCircle className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">কোনো মেসেজ নেই</p>
      <p className="text-xs text-muted-foreground">প্রথম মেসেজ পাঠান!</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Skeletons
   ═══════════════════════════════════════════════════════════ */

export function DealDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="লোড হচ্ছে">
      {/* Title block */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-3.5 w-40 animate-pulse rounded bg-muted" />
      </div>
      {/* Tracker */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      {/* Amount */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-2.5 h-8 w-36 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-3.5 w-52 animate-pulse rounded bg-muted" />
      </div>
      {/* Party cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      {/* Actions */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-12 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
