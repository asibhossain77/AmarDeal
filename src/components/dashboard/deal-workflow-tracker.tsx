'use client';

import { useState, useRef, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type DealStatus } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileCheck,
  Send,
  ShieldCheck,
  Truck,
  ThumbsUp,
  Check,
  Clock,
  Banknote,
  User,
  CalendarDays,
  ScrollText,
  Receipt,
  SendHorizonal,
  Shield,
  Bot,
  Loader2,
  PackageCheck,
  AlertTriangle,
  XCircle,
  Ban,
  MessageCircle,
  Info,
  Lock,
  Headphones,
} from 'lucide-react';

const emptySubscribe = () => () => {};

/* ── Payout method select (auto-locked to deal's payment method) ── */
function PayoutMethodSelect({
  methods,
  value,
  onChange,
  locked,
}: {
  methods: { id: string; name: string; accountType: string }[];
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  const sel = methods.find((m) => m.name === value);
  return (
    <>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          className={`w-full h-10 rounded-xl border border-border/50 bg-background px-3 pr-8 text-sm outline-none transition-colors ${
            locked
              ? 'opacity-70 cursor-not-allowed bg-muted/30'
              : 'focus:border-[rgba(101,163,13,0.4)] focus:ring-1 focus:ring-[rgba(101,163,13,0.15)]'
          }`}
        >
          {methods.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name} — {m.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'}
            </option>
          ))}
        </select>
        {locked && (
          <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        )}
      </div>
      {sel && (
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              sel.accountType === 'merchant'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400'
            }`}
          >
            {sel.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'}
          </span>
          {locked && (
            <span className="text-[10px] text-muted-foreground">ডিলের পেমেন্ট মেথড</span>
          )}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Color Constants
   ═══════════════════════════════════════════════════════════ */

const PARROT_GREEN = '#65A30D';
const PARROT_GREEN_LIGHT = '#84CC16';
const PARROT_GREEN_MILD = 'rgba(101, 163, 13, 0.10)';
const PARROT_GREEN_GLOW = '0 4px 16px rgba(101, 163, 13, 0.30)';

/* ═══════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════ */

/** 5-step escrow progress */
const STEPS = [
  { num: '১', label: 'ডিল তৈরি', icon: FileCheck, statusKey: 'created' as const },
  { num: '২', label: 'পেমেন্ট', icon: Send, statusKey: 'payment_pending' as const },
  { num: '৩', label: 'ভেরিফিকেশন', icon: ShieldCheck, statusKey: 'payment_verified' as const },
  { num: '৪', label: 'ডেলিভারি', icon: Truck, statusKey: 'in_delivery' as const },
  { num: '৫', label: 'ডিল সম্পন্ন', icon: ThumbsUp, statusKey: 'completed' as const },
];

/**
 * Maps a deal status to the active step index.
 * Steps 0-4 correspond to the 5 STEPS.
 * -1 means no steps are active (cancelled/rejected/disputed before delivery).
 */
function statusToActiveStep(status: string): number {
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
function getStatusLabel(status: string): string {
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

/** Status badge */
function getStatusBadge(status: string) {
  switch (status) {
    case 'created':
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 font-medium">তৈরি হয়েছে</Badge>;
    case 'payment_pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">পেমেন্ট পেন্ডিং</Badge>;
    case 'payment_verified':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium">ভেরিফাইড</Badge>;
    case 'in_delivery':
      return <Badge className="border-0 font-medium" style={{ backgroundColor: PARROT_GREEN_MILD, color: PARROT_GREEN }}>ডেলিভারি চলছে</Badge>;
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

/** Chat message roles */
type MessageRole = 'buyer' | 'seller' | 'admin' | 'system';

interface ChatMessage {
  id: string;
  role: MessageRole;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

/** Convert ISO date string to Bengali time */
function toBnTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Convert DB message to ChatMessage */
function dbToChatMsg(m: { id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string }): ChatMessage {
  return {
    id: m.id,
    role: (m.role as MessageRole) || 'system',
    senderId: m.senderId,
    senderName: m.senderName || 'অজানা',
    text: m.text,
    timestamp: toBnTime(m.createdAt),
  };
}

/* ═══════════════════════════════════════════════════════════
   API response type for deal fetch
   ═══════════════════════════════════════════════════════════ */

interface DealData {
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
  buyer: { id: string; name: string; email: string; phone: string } | null;
  seller: { id: string; name: string; email: string; phone: string } | null;
  creator: { id: string; name: string; email: string } | null;
  paymentMethod?: { id: string; name: string; accountType: string } | null;
}

/* ═══════════════════════════════════════════════════════════
   Sub-Components: Progress Steppers
   ═══════════════════════════════════════════════════════════ */

/**
 * Horizontal 5-step progress bar (desktop).
 * Uses parrot green #65A30D for active/completed steps.
 */
function HorizontalStepper({ activeStep, isDisputed, isCancelled }: { activeStep: number; isDisputed: boolean; isCancelled: boolean }) {
  if (isCancelled) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-6 py-4 border border-red-200 dark:border-red-500/20">
          <Ban className="h-8 w-8 text-red-500" />
          <div>
            <p className="text-base font-bold text-red-700 dark:text-red-400">ডিল বাতিল হয়েছে</p>
            <p className="text-sm text-red-600/70 dark:text-red-400/70">এই ডিল আর সক্রিয় নয়</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-start justify-between py-2">
      {/* Background track line */}
      <div className="absolute top-[20px] left-[20px] right-[20px] h-[4px] rounded-full bg-border/40" />
      {/* Filled progress line */}
      {activeStep >= 0 && (
        <div
          className="absolute top-[20px] left-[20px] h-[4px] rounded-full transition-all duration-700 ease-out"
          style={{
            width: activeStep >= STEPS.length - 1
              ? 'calc(100% - 40px)'
              : `calc(${(activeStep / (STEPS.length - 1)) * 100}% - 20px)`,
            backgroundColor: isDisputed ? '#EF4444' : PARROT_GREEN,
          }}
        />
      )}

      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = i < activeStep;
        const isActive = i === activeStep;

        return (
          <div
            key={step.num}
            className="relative z-10 flex flex-col items-center"
            style={{ width: `${100 / STEPS.length}%` }}
          >
            <div className="relative">
              {/* Pulse rings for active step */}
              {isActive && (
                <>
                  <span
                    className="absolute -inset-2.5 rounded-full border-2 animate-ping opacity-20"
                    style={{ borderColor: isDisputed ? '#EF4444' : PARROT_GREEN }}
                  />
                  <span
                    className="absolute -inset-1.5 rounded-full border-2 animate-pulse"
                    style={{ borderColor: isDisputed ? 'rgba(239,68,68,0.25)' : 'rgba(101,163,13,0.25)' }}
                  />
                </>
              )}
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] transition-all duration-300"
                style={{
                  backgroundColor: isCompleted || isActive
                    ? (isDisputed && isActive ? '#FEE2E2' : PARROT_GREEN)
                    : 'var(--background)',
                  borderColor: isCompleted || isActive
                    ? (isDisputed && isActive ? '#EF4444' : PARROT_GREEN)
                    : 'var(--border)',
                  color: isCompleted ? '#fff' : (isActive && isDisputed ? '#EF4444' : (isActive ? '#fff' : 'var(--muted-foreground)')),
                  boxShadow: (isCompleted || isActive) && !isDisputed ? PARROT_GREEN_GLOW : 'none',
                }}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : isActive && isDisputed ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
            </div>
            <p
              className="mt-3 text-center text-[11px] font-semibold leading-tight"
              style={{ color: isCompleted || isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}
            >
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Vertical 5-step stepper (mobile).
 */
function VerticalStepper({ activeStep, isDisputed, isCancelled }: { activeStep: number; isDisputed: boolean; isCancelled: boolean }) {
  if (isCancelled) {
    return (
      <div className="flex items-center justify-center py-3 md:py-6">
        <div className="flex items-center gap-2.5 md:gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-4 py-3 md:px-6 md:py-4 border border-red-200 dark:border-red-500/20 w-full">
          <Ban className="h-6 w-6 md:h-8 md:w-8 text-red-500 shrink-0" />
          <div>
            <p className="text-sm md:text-base font-bold text-red-700 dark:text-red-400">ডিল বাতিল হয়েছে</p>
            <p className="text-xs md:text-sm text-red-600/70 dark:text-red-400/70">এই ডিল আর সক্রিয় নয়</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: Compact horizontal progress bar ── */}
      <div className="md:hidden">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isCompleted = i < activeStep;
            const isActive = i === activeStep;
            const isLast = i === STEPS.length - 1;
            return (
              <div key={step.num} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300"
                    style={{
                      backgroundColor: isCompleted || isActive
                        ? (isDisputed && isActive ? '#FEE2E2' : PARROT_GREEN)
                        : 'var(--background)',
                      borderColor: isCompleted || isActive
                        ? (isDisputed && isActive ? '#EF4444' : PARROT_GREEN)
                        : 'var(--border)',
                      color: isCompleted ? '#fff' : (isActive && isDisputed ? '#EF4444' : (isActive ? '#fff' : 'var(--muted-foreground)')),
                    }}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="text-[10px] font-bold">{step.num}</span>}
                  </div>
                  <span
                    className="text-[9px] leading-tight text-center truncate max-w-[52px]"
                    style={{ color: isCompleted || isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                  >
                    {step.label}
                  </span>
                </div>
                {!isLast && (
                  <div className="flex-1 h-[3px] mx-1 rounded-full">
                    <div
                      className="h-full rounded-full transition-colors"
                      style={{ backgroundColor: isCompleted ? PARROT_GREEN : 'var(--border)' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(isDisputed || (activeStep >= 0 && activeStep < STEPS.length)) && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {isDisputed && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-red-500">
                <AlertTriangle className="h-3 w-3" /> বিরোধ দায়ের হয়েছে
              </span>
            )}
            {!isDisputed && activeStep < STEPS.length - 1 && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                </span>
                {STEPS[activeStep]?.label} — অপেক্ষমান
              </span>
            )}
            {!isDisputed && activeStep === STEPS.length - 1 && (
              <span className="text-[10px] font-medium" style={{ color: PARROT_GREEN }}>সম্পন্ন ✓</span>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop: Full vertical stepper ── */}
      <div className="hidden md:block space-y-0">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isCompleted = i < activeStep;
          const isActive = i === activeStep;
          const isLast = i === STEPS.length - 1;

          return (
            <div key={step.num} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="relative">
                  {isActive && (
                    <span
                      className="absolute -inset-2 rounded-full border-2 animate-pulse"
                      style={{ borderColor: isDisputed ? 'rgba(239,68,68,0.25)' : 'rgba(101,163,13,0.25)' }}
                    />
                  )}
                  <div
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] transition-all duration-300"
                    style={{
                      backgroundColor: isCompleted || isActive
                        ? (isDisputed && isActive ? '#FEE2E2' : PARROT_GREEN)
                        : 'var(--background)',
                      borderColor: isCompleted || isActive
                        ? (isDisputed && isActive ? '#EF4444' : PARROT_GREEN)
                        : 'var(--border)',
                      color: isCompleted ? '#fff' : (isActive && isDisputed ? '#EF4444' : (isActive ? '#fff' : 'var(--muted-foreground)')),
                      boxShadow: (isCompleted || isActive) && !isDisputed ? PARROT_GREEN_GLOW : 'none',
                    }}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : isActive && isDisputed ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                </div>
                {!isLast && (
                  <div className="w-[3px] flex-1 min-h-8 my-1.5 rounded-full">
                    <div
                      className="h-full w-full rounded-full transition-colors"
                      style={{ backgroundColor: isCompleted ? PARROT_GREEN : 'var(--border)' }}
                    />
                  </div>
                )}
              </div>

              <div className={`flex flex-col justify-center ${isLast ? '' : 'pb-4'}`}>
                <p
                  className="text-sm font-semibold leading-tight"
                  style={{ color: isCompleted || isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                >
                  {step.label}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    ধাপ {step.num}
                  </span>
                  {isCompleted && (
                    <span className="text-xs font-medium" style={{ color: PARROT_GREEN }}>সম্পন্ন</span>
                  )}
                  {isActive && !isDisputed && (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-500 dark:text-amber-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </span>
                      অপেক্ষমান
                    </span>
                  )}
                  {isActive && isDisputed && (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      বিরোধ
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Sub-Components: Deal Info Section
   ═══════════════════════════════════════════════════════════ */

/**
 * Info card used in the 2×2 detail grid.
 * Soft rounded corners, subtle border, glass-like feel.
 */
function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl md:rounded-2xl border border-border/40 bg-card p-3 md:p-4 transition-all duration-200 hover:border-[rgba(101,163,13,0.25)] hover:shadow-md hover:shadow-[rgba(101,163,13,0.06)]">
      <div
        className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-lg md:rounded-xl transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: PARROT_GREEN_MILD, color: PARROT_GREEN }}
      >
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] md:text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <p className="text-xs md:text-sm font-bold truncate text-foreground mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Action button with enhanced hover effect.
 */
function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  loading = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger';
  loading?: boolean;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant={isPrimary ? 'default' : 'outline'}
      className={`
        w-full flex-1 h-13 md:h-14 rounded-xl md:rounded-2xl text-base md:text-lg font-bold gap-2.5
        transition-all duration-200
        hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
        ${isPrimary
          ? ''
          : 'text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50'
        }
      `}
      style={isPrimary ? {
        backgroundColor: PARROT_GREEN,
        color: '#fff',
        boxShadow: PARROT_GREEN_GLOW,
      } : undefined}
    >
      {loading ? <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" /> : children}
    </Button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Sub-Components: Chat System
   ═══════════════════════════════════════════════════════════ */

/**
 * Chat message bubble — modern rounded design.
 * Buyer/Seller: aligned left/right, colored bubbles.
 * Admin: center-aligned, purple accent.
 * System: center-aligned, amber/orange accent.
 */
function ChatBubble({ message, currentUserId }: { message: ChatMessage; currentUserId?: string }) {
  const { role, senderName, text, timestamp } = message;

  /* ── System messages: center-aligned, amber accent ── */
  if (role === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-center py-1"
      >
        <div className="flex flex-col items-center gap-1.5 max-w-[90%] sm:max-w-[75%]">
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/60 dark:border-amber-500/20 px-4 py-2.5 text-center"
            style={{
              backgroundColor: 'rgba(251, 191, 36, 0.08)',
              boxShadow: '0 1px 3px rgba(251,191,36,0.06)',
            }}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-200/90">
              {text}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-amber-500/60 dark:text-amber-400/50">
            <Clock className="h-2.5 w-2.5" />
            {timestamp}
          </span>
        </div>
      </motion.div>
    );
  }

  /* ── Admin messages: center-aligned, purple accent ── */
  if (role === 'admin') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-center py-1"
      >
        <div className="flex flex-col items-center gap-1.5 max-w-[90%] sm:max-w-[75%]">
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="flex h-4.5 w-4.5 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-500/15">
              <ShieldCheck className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 tracking-wide uppercase">
              Admin
            </span>
          </div>
          <div className="rounded-2xl border border-purple-200/60 dark:border-purple-500/20 px-5 py-3 text-center"
            style={{
              backgroundColor: 'rgba(147, 51, 234, 0.06)',
              boxShadow: '0 1px 3px rgba(147,51,234,0.06)',
            }}
          >
            <p className="text-[13px] leading-relaxed text-purple-900 dark:text-purple-200">
              {text}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-purple-500/60 dark:text-purple-400/50">
            <Clock className="h-2.5 w-2.5" />
            {timestamp}
          </span>
        </div>
      </motion.div>
    );
  }

  /* ── Buyer/Seller messages: own → right, other → left ── */
  const isOwn = currentUserId && message.senderId === currentUserId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, x: isOwn ? 10 : -10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex flex-col gap-1 max-w-[80%] sm:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 px-1">
          {/* Avatar initial */}
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
            style={{
              backgroundColor: isOwn ? PARROT_GREEN : 'var(--muted)',
              color: isOwn ? '#fff' : 'var(--muted-foreground)',
            }}
          >
            {senderName.charAt(0)}
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {senderName}
          </span>
        </div>

        <div
          className="rounded-2xl px-4 py-2.5 transition-transform duration-150 hover:scale-[1.01]"
          style={{
            backgroundColor: isOwn ? PARROT_GREEN : 'var(--card)',
            color: isOwn ? '#fff' : 'var(--foreground)',
            borderBottomRightRadius: isOwn ? '6px' : '16px',
            borderBottomLeftRadius: isOwn ? '16px' : '6px',
            boxShadow: isOwn
              ? `0 2px 12px ${PARROT_GREEN}30`
              : '0 1px 3px rgba(0,0,0,0.06)',
            border: isOwn ? 'none' : '1px solid var(--border)',
          }}
        >
          <p className="text-sm leading-relaxed">{text}</p>
        </div>

        <span className="flex items-center gap-1 px-1">
          <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/60">{timestamp}</span>
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Chat date divider.
 */
function ChatDateDivider({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/30" />
        <span className="text-[10px] font-medium text-muted-foreground/60">{text}</span>
        <div className="h-px flex-1 bg-border/30" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Exported Component
   ═══════════════════════════════════════════════════════════ */

export function DealWorkflowTracker() {
  const { setDashboardPanel, activeDeal, user } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  /* ── Tab state (custom pill toggle) ── */
  const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info');

  /* ── Deal data from DB ── */
  const [dealData, setDealData] = useState<DealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [adminCallLoading, setAdminCallLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMsgCountRef = useRef(0);

  /* ── Payout form state ── */
  const [payoutMethods, setPayoutMethods] = useState<{ id: string; name: string; accountType: string }[]>([]);
  const [payoutAccountType, setPayoutAccountType] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutSubmitted, setPayoutSubmitted] = useState(false);
  const [payoutPaid, setPayoutPaid] = useState(false);
  const [payoutChecking, setPayoutChecking] = useState(true);
  const [submittedPayoutInfo, setSubmittedPayoutInfo] = useState<{ accountType: string; accountNumber: string; accountName: string } | null>(null);

  /* ── Derived state ── */
  const status = dealData?.status || activeDeal?.status || 'created';
  const activeStep = statusToActiveStep(status);
  const isDisputed = status === 'disputed';
  const isCancelled = status === 'cancelled' || status === 'rejected';
  const isCompleted = status === 'completed';
  const dealHasPaymentMethod = !!dealData?.paymentMethod?.name;
  const userId = user?.id;
  const isBuyer = userId === (dealData?.buyerId || activeDeal?.buyerId) || (userId === activeDeal?.buyerId);
  const isSeller = userId === (dealData?.sellerId) || userId === activeDeal?.sellerId || (!isBuyer && user?.isSeller);

  /* ── Fetch active payment methods & auto-select deal's method ── */
  useEffect(() => {
    fetch('/api/payment-methods')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; name: string; accountType: string; status: string }[]) => {
        const active = data.filter((m) => m.status === 'active');
        setPayoutMethods(active);
        // Auto-select the deal's own payment method
        const dealMethodName = dealData?.paymentMethod?.name;
        if (dealMethodName && active.some((m) => m.name === dealMethodName)) {
          setPayoutAccountType(dealMethodName);
        } else if (active.length > 0) {
          setPayoutAccountType(active[0].name);
        }
      })
      .catch(() => {});
  }, [dealData?.paymentMethod?.name]);

  /* ── Check if payout already submitted for current deal ── */
  const checkPayoutStatus = useCallback((showLoading = false) => {
    if (!dealData?.id || !userId) return;
    const currentStatus = dealData?.status || activeDeal?.status || 'created';
    const currentIsCompleted = currentStatus === 'completed';
    const currentIsCancelled = currentStatus === 'cancelled' || currentStatus === 'rejected';
    const currentIsBuyer = userId === (dealData?.buyerId || activeDeal?.buyerId) || userId === activeDeal?.buyerId;
    const currentIsSeller = userId === dealData?.sellerId || userId === activeDeal?.sellerId || (!currentIsBuyer && user?.isSeller);
    // No refund for rejected deals (admin rejected = wrong/invalid transaction)
    // Only cancelled deals allow buyer refund
    const noRefund = currentStatus === 'rejected';
    const checkType = currentIsCompleted && currentIsSeller ? 'seller_payout' : (currentStatus === 'cancelled' && currentIsBuyer && !noRefund) ? 'buyer_refund' : null;
    if (!checkType) {
      setPayoutChecking(false);
      return;
    }
    if (showLoading) setPayoutChecking(true);
    fetch('/api/user/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((payouts: { dealId: string; type: string; status: string; accountType: string; accountNumber: string; accountName: string }[]) => {
        const match = payouts.find((p) => p.dealId === dealData!.id && p.type === checkType);
        // Only update states if we found a match — never reset submitted/paid back to false
        // (prevents polling API hiccups from showing the form again)
        if (match) {
          setPayoutSubmitted(true);
          setPayoutPaid(match.status === 'paid');
          setSubmittedPayoutInfo({ accountType: match.accountType, accountNumber: match.accountNumber, accountName: match.accountName });
        }
      })
      .catch(() => {})
      .finally(() => setPayoutChecking(false));
  }, [dealData?.id, userId, dealData?.status, activeDeal?.buyerId, activeDeal?.sellerId, dealData?.buyerId, dealData?.sellerId, user?.isSeller]);

  // Initial check with loading skeleton
  useEffect(() => {
    checkPayoutStatus(true);
  }, [checkPayoutStatus]);

  /* ── Fetch deal from DB ── */
  const fetchDeal = useCallback(async () => {
    if (!activeDeal?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}`);
      if (res.ok) {
        const data: DealData = await res.json();
        setDealData(data);

        if (data.status !== activeDeal.status) {
          useAppStore.getState().setActiveDeal({
            id: data.id,
            title: data.title,
            amount: data.amount,
            status: data.status,
            createdAt: data.createdAt,
            buyerId: data.buyerId,
            sellerId: data.sellerId || undefined,
            creatorId: data.creatorId,
            buyerName: data.buyer?.name,
            sellerName: data.seller?.name,
            rejectionReason: data.rejectionReason,
          });
        }
      }
    } catch {
      // Use store data as fallback
    } finally {
      setLoading(false);
    }
  }, [activeDeal?.id, activeDeal?.status]);

  useEffect(() => {
    fetchDeal();
  }, [fetchDeal]);

  /* Auto-scroll chat — only if user is near bottom */
  const isNearBottomRef = useRef(true);

  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    // Consider "near bottom" if within 80px of the bottom
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  /* No auto-scroll on incoming messages — only on user send */

  /* Focus input when switching to chat tab */
  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeTab]);

  /* ── Auth headers for API calls ── */
  const authHeaders = useCallback(() => ({
    'X-User-Id': user?.id || '',
  }), [user?.id]);

  /* ── Fetch chat messages from API ── */
  const fetchMessages = useCallback(async () => {
    if (!activeDeal?.id) return;
    setChatLoading(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string }> = await res.json();
        setMessages(data.map(dbToChatMsg));
      }
    } catch {
      // silent
    } finally {
      setChatLoading(false);
    }
  }, [activeDeal?.id, authHeaders]);

  /* ── Connect to polling for real-time chat + deal status ── */
  useEffect(() => {
    if (!activeDeal?.id) return;

    fetchMessages();

    let pollCount = 0;
    // Poll every 3 seconds for new messages, refresh deal data every 10s
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string }> = await res.json();
          setMessages(data.map(dbToChatMsg));
        }
      } catch {
        // silent - will retry on next interval
      }

      // Refresh deal data + payout status every ~9 seconds (every 3rd poll)
      pollCount++;
      if (pollCount % 3 === 0) {
        try {
          const dealRes = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}`);
          if (dealRes.ok) {
            const data: DealData = await dealRes.json();
            setDealData((prev) => {
              if (!prev) return data;
              // Update entire deal data if anything changed (admin edits, payment amount, status, etc.)
              const changed =
                prev.status !== data.status ||
                prev.adminCalled !== data.adminCalled ||
                prev.paymentAmount !== data.paymentAmount ||
                prev.platformFee !== data.platformFee ||
                prev.rejectionReason !== data.rejectionReason;
              return changed ? data : prev;
            });
          }
        } catch {
          // silent
        }
        // Re-check payout status to detect admin mark-paid
        checkPayoutStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDeal?.id, fetchMessages, authHeaders, checkPayoutStatus]);

  if (!mounted) return null;

  const dealAmount = dealData?.amount ?? activeDeal?.amount ?? 0;
  const dealTitle = dealData?.title || activeDeal?.title || 'ডিল';
  const dealDate = (dealData?.createdAt || activeDeal?.createdAt)
    ? new Date(dealData?.createdAt || activeDeal?.createdAt || '').toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
    : '---';
  const buyerName = dealData?.buyer?.name || activeDeal?.buyerName || user?.name || 'ক্রেতা';
  const sellerName = dealData?.seller?.name || activeDeal?.sellerName || 'বিক্রেতা';
  const dealTerms = dealData?.terms;

  /* ── Action handlers ── */
  const handleDeliver = async () => {
    if (!dealData) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/deals/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.success('কাজ সম্পন্ন হিসেবে চিহ্নিত হয়েছে! ক্রেতাকে জানানো হচ্ছে।');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!dealData) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/deals/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.success('ডিলটি বাতিল করা হয়েছে');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'বাতিল করতে সমস্যা');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!dealData) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/deals/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.success('পণ্য/সেবা গ্রহণ নিশ্চিত করা হয়েছে! ডিল সম্পন্ন।');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'নিশ্চিত করতে সমস্যা');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!dealData || !userId || !payoutAccountType || !payoutAccountNumber || !payoutAccountName) return;
    setPayoutLoading(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealData.id)}/request-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          accountType: payoutAccountType,
          accountNumber: payoutAccountNumber,
          accountName: payoutAccountName,
        }),
      });
      if (res.ok) {
        toast.success(isCompleted ? 'পেআউট অনুরোধ জমা হয়েছে!' : 'ফেরতের অনুরোধ জমা হয়েছে!');
        setPayoutSubmitted(true);
        setSubmittedPayoutInfo({ accountType: payoutAccountType, accountNumber: payoutAccountNumber, accountName: payoutAccountName });
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'পেআউট অনুরোধে সমস্যা');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!dealData) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/deals/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.error('বিরোধ দায়ের করা হয়েছে। অ্যাডমিন পর্যালোচনা করবেন।');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'বিরোধ দায়েরে সমস্যা');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setActionLoading(false);
    }
  };

  /** Send chat message via API */
  const handleSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !activeDeal?.id || !user?.id) return;
    setSendingMsg(true);
    try {
      const role = isBuyer ? 'buyer' : 'seller';
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          role,
          senderName: user.name || 'আপনি',
          text: trimmed,
        }),
      });
      if (res.ok) {
        // Immediately fetch messages so the sent message appears without waiting for poll
        const msgRes = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
          headers: authHeaders(),
        });
        if (msgRes.ok) {
          const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string }> = await msgRes.json();
          setMessages(data.map(dbToChatMsg));
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        toast.error('মেসেজ পাঠাতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setChatInput('');
      setSendingMsg(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  /* ── Call Admin ── */
  const handleCallAdmin = async () => {
    if (!activeDeal?.id || adminCallLoading) return;
    setAdminCallLoading(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/call-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': user?.id || '' },
      });
      if (res.ok) {
        setDealData((prev) => prev ? { ...prev, adminCalled: true } : prev);
        // Re-fetch messages so the system message appears
        const msgRes = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
          headers: authHeaders(),
        });
        if (msgRes.ok) {
          const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string }> = await msgRes.json();
          setMessages(data.map(dbToChatMsg));
        }
        toast.success('অ্যাডমিনকে ডাকা হয়েছে!');
      } else {
        toast.error('অ্যাডমিন ডাকতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setAdminCallLoading(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
      RENDER
      ═══════════════════════════════════════════════════════════ */

  const isChatView = activeTab === 'chat';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`w-full ${isChatView ? 'h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-8rem)]' : 'flex-1 min-h-0 sm:max-h-[calc(100dvh-7rem)] lg:max-h-[calc(100dvh-8rem)]'} flex flex-col`}
    >
      {/* ═════════════════════════════════════════
          Container Card
          ═════════════════════════════════════════ */}
      <div
        className={`flex flex-col ${isChatView ? 'overflow-hidden h-full' : 'flex-1 min-h-0'} rounded-2xl border border-border/60 shadow-lg ${isChatView ? '!rounded-none border-x-0 border-b-0' : ''}`}
        style={{
          backgroundColor: 'var(--background)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b border-border/50 px-4 py-3 sm:px-6"
          style={{ backgroundColor: 'var(--card)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => { useAppStore.getState().setActiveDeal(null); useAppStore.getState().goBack(); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:bg-accent hover:scale-105"
              aria-label="ফিরে যান"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm"
                style={{ backgroundColor: PARROT_GREEN }}
              >
                <span className="text-sm font-bold text-white">আ</span>
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-foreground">
                  আমার ডিল
                </span>
                <p className="text-[10px] text-muted-foreground hidden sm:block">
                  DL-{(dealData?.id || activeDeal?.id || '').slice(-5)}
                </p>
              </div>
            </div>
          </div>

          {/* Breadcrumb nav (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => { useAppStore.getState().setActiveDeal(null); useAppStore.getState().goBack(); }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              আমার ডিলসমূহ
            </button>
            <span className="text-xs text-muted-foreground/40">/</span>
            <span className="px-3 py-1.5 text-xs font-medium text-foreground">
              {dealTitle}
            </span>
          </nav>

          {/* Avatar */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:block text-xs font-medium text-muted-foreground max-w-[100px] truncate">
              {user?.name || 'ইউজার'}
            </span>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: PARROT_GREEN_MILD, color: PARROT_GREEN }}
            >
              {user?.name?.charAt(0) || 'ই'}
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════
            Pill-Shaped Tab Toggle
            ═════════════════════════════════════════ */}
        <div className="px-4 pt-3 pb-0 sm:px-6 sm:pt-4">
          <div className="relative flex items-center p-1 rounded-xl bg-muted/60 w-fit mx-auto">
            {/* Sliding indicator */}
            <motion.div
              className="absolute top-1 bottom-1 left-1 right-1 rounded-lg"
              style={{ backgroundColor: PARROT_GREEN, boxShadow: PARROT_GREEN_GLOW, width: 'calc(50% - 4px)' }}
              animate={{
                x: activeTab === 'info' ? 0 : '100%',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => setActiveTab('info')}
              className="relative z-10 flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ color: activeTab === 'info' ? '#fff' : 'var(--muted-foreground)' }}
            >
              <Info className="h-4 w-4" />
              ডিলের তথ্য
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className="relative z-10 flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ color: activeTab === 'chat' ? '#fff' : 'var(--muted-foreground)' }}
            >
              <MessageCircle className="h-4 w-4" />
              ডিল চ্যাট
              {/* Unread dot indicator */}
              <span
                className="flex h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: activeTab === 'chat' ? '#fff' : PARROT_GREEN }}
              />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            TAB CONTENT
            ═══════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════
              TAB 1: ডিলের তথ্য (Deal Info)
              ═══════════════════════════════════════ */}
          {activeTab === 'info' && (
            <motion.div
              key="deal-info"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex-1 min-h-0 md:overflow-y-auto"
            >
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex flex-col justify-between">
                {/* ── Deal title + status badge ── */}
                <div className="flex items-center gap-3 sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-bold text-foreground truncate">
                      {dealTitle}
                    </h2>
                    <p className="text-xs sm:text-xs text-muted-foreground mt-0.5">
                      DL-{(dealData?.id || activeDeal?.id || '').slice(-5)} · {dealDate}
                    </p>
                  </div>
                  <div className="shrink-0">{getStatusBadge(status)}</div>
                </div>

                {/* ── 5-Step Progress Bar ── */}
                <div className="rounded-xl md:rounded-2xl border border-border/40 bg-card/50 p-3.5 sm:p-5">
                  <div className="hidden md:block">
                    <HorizontalStepper activeStep={activeStep} isDisputed={isDisputed} isCancelled={isCancelled} />
                  </div>
                  <div className="md:hidden">
                    <VerticalStepper activeStep={activeStep} isDisputed={isDisputed} isCancelled={isCancelled} />
                  </div>
                </div>

                {/* ── Details Grid (2-col on mobile) ── */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <InfoCard
                    icon={Banknote}
                    label="ডিলের পরিমাণ"
                    value={`৳${dealAmount.toLocaleString('en')}`}
                  />
                  {dealData?.paymentAmount != null && dealData.paymentAmount !== dealData.amount && (
                    <InfoCard
                      icon={Banknote}
                      label="প্রকৃত পেমেন্টের পরিমাণ"
                      value={`৳${dealData.paymentAmount.toLocaleString('en')}`}
                    />
                  )}
                  {dealData?.platformFee != null && dealData.platformFee > 0 && (
                    <InfoCard
                      icon={Receipt}
                      label="প্ল্যাটফর্ম ফি"
                      value={`৳${dealData.platformFee.toLocaleString('en')}`}
                    />
                  )}
                  <InfoCard
                    icon={User}
                    label="ক্রেতা"
                    value={buyerName}
                  />
                  <InfoCard
                    icon={User}
                    label="বিক্রেতা"
                    value={sellerName}
                  />
                  <div className="hidden sm:block">
                    <InfoCard
                      icon={CalendarDays}
                      label="তৈরির তারিখ"
                      value={dealDate}
                    />
                  </div>
                </div>

                {/* ── Deal Terms (hidden on mobile) ── */}
                {dealTerms && (
                  <div className="hidden sm:block rounded-2xl border border-border/40 bg-card/50 p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{ backgroundColor: PARROT_GREEN_MILD }}
                      >
                        <ScrollText className="h-4 w-4" style={{ color: PARROT_GREEN }} />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">
                        ডিলের শর্তাবলী
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line pl-9">
                      {dealTerms}
                    </p>
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    CONDITIONAL ACTION BUTTONS
                    ═══════════════════════════════════════ */}

                {/* Buyer: Pay (status = created) */}
                {isBuyer && status === 'created' && (
                  <div className="space-y-3">
                    {dealData?.rejectionReason === 'wrong_info' && (
                      <div className="flex items-start gap-2.5 rounded-xl md:rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-3.5 py-3 md:px-5 md:py-4 border border-amber-200 dark:border-amber-500/20">
                        <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs md:text-sm font-bold text-amber-700 dark:text-amber-400">
                            আপনার পেমেন্ট তথ্যে ভুল পাওয়া গেছে
                          </p>
                          <p className="text-[11px] md:text-xs text-amber-600 dark:text-amber-500/80">
                            অনুগ্রহ করে সঠিক তথ্য দিয়ে আবার পেমেন্ট করুন। পূর্বের পেমেন্টের টাকা এই কারণে রিফান্ড হবে না।
                          </p>
                        </div>
                      </div>
                    )}
                    <ActionButton onClick={() => setDashboardPanel('payment')} variant="primary">
                      <ShieldCheck className="h-5 w-5" />
                      পেমেন্ট করুন
                    </ActionButton>
                  </div>
                )}

                {/* Buyer: Waiting for verification (status = payment_pending) */}
                {isBuyer && status === 'payment_pending' && (
                  <div className="flex items-center gap-2.5 rounded-xl md:rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-3.5 py-3 md:px-5 md:py-4 border border-amber-200 dark:border-amber-500/20">
                    <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-500 shrink-0" />
                    <p className="text-xs md:text-sm font-medium text-amber-700 dark:text-amber-400">
                      পেমেন্ট ভেরিফিকেশনের অপেক্ষায়
                    </p>
                  </div>
                )}

                {/* Seller: Deliver + Cancel (status = payment_verified) */}
                {isSeller && status === 'payment_verified' && (
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 border" style={{ backgroundColor: PARROT_GREEN_MILD, borderColor: 'rgba(101,163,13,0.2)' }}>
                      <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: PARROT_GREEN }} />
                      <p className="text-xs md:text-sm font-medium text-foreground">
                        পেমেন্ট ভেরিফাইড — আপনি কাজ সম্পূর্ণ করুন
                      </p>
                    </div>
                    <div className="flex gap-2 md:gap-3">
                      <ActionButton onClick={handleDeliver} loading={actionLoading} variant="primary">
                        <PackageCheck className="h-5 w-5" />
                        কাজ সম্পন্ন
                      </ActionButton>
                      <ActionButton onClick={handleCancel} loading={actionLoading} variant="danger">
                        <XCircle className="h-5 w-5" />
                        ক্যান্সেল করুন
                      </ActionButton>
                    </div>
                  </div>
                )}

                {/* Buyer: Accept + Dispute (status = in_delivery) */}
                {isBuyer && status === 'in_delivery' && (
                  <div className="space-y-2 md:space-y-3">
                    <p className="text-xs md:text-sm text-center font-medium text-muted-foreground">
                      বিক্রেতা ডেলিভারি করেছেন। নিশ্চিত করুন।
                    </p>
                    <div className="flex gap-2 md:gap-3">
                      <ActionButton onClick={handleAccept} loading={actionLoading} variant="primary">
                        <ThumbsUp className="h-5 w-5" />
                        পণ্য/সার্ভিস পেয়েছি
                      </ActionButton>
                      <ActionButton onClick={handleDispute} loading={actionLoading} variant="danger">
                        <AlertTriangle className="h-5 w-5" />
                        বিরোধ
                      </ActionButton>
                    </div>
                  </div>
                )}

                {/* Seller: Waiting for buyer (status = in_delivery) */}
                {isSeller && status === 'in_delivery' && (
                  <div className="flex items-center gap-2.5 rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border" style={{ backgroundColor: PARROT_GREEN_MILD, borderColor: 'rgba(101,163,13,0.2)' }}>
                    <Truck className="h-4 w-4 md:h-5 md:w-5 shrink-0" style={{ color: PARROT_GREEN }} />
                    <p className="text-xs md:text-sm font-medium text-foreground">
                      ক্রেতার নিশ্চিতকরণের অপেক্ষায়
                    </p>
                  </div>
                )}

                {/* Buyer: Waiting for seller (status = payment_verified, buyer view) */}
                {isBuyer && status === 'payment_verified' && (
                  <div className="flex items-center gap-2.5 rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border" style={{ backgroundColor: PARROT_GREEN_MILD, borderColor: 'rgba(101,163,13,0.2)' }}>
                    <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 shrink-0" style={{ color: PARROT_GREEN }} />
                    <p className="text-xs md:text-sm font-medium text-foreground">
                      পেমেন্ট ভেরিফাইড
                    </p>
                  </div>
                )}

                {/* Disputed state */}
                {isDisputed && (
                  <div className="flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-5 py-4 border border-red-200 dark:border-red-500/20">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      বিরোধ দায়ের করা হয়েছে। অ্যাডমিন পর্যালোচনা করছেন।
                    </p>
                  </div>
                )}

                {/* Completed state – Seller payout */}
                {isCompleted && isSeller && (
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        ডিল সফলভাবে সম্পন্ন হয়েছে!
                      </p>
                    </div>
                    {payoutChecking ? (
                      <div className="space-y-3">
                        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                      </div>
                    ) : !payoutSubmitted ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground font-medium">আপনার পেমেন্ট পেতে নিচের ফর্ম পূরণ করুন</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">পেমেন্ট পদ্ধতি</label>
                            {payoutMethods.length > 0 ? (
                              <PayoutMethodSelect
                                methods={payoutMethods}
                                value={payoutAccountType}
                                onChange={setPayoutAccountType}
                                locked={dealHasPaymentMethod}
                              />
                            ) : (
                              <p className="text-xs text-amber-600 dark:text-amber-400 py-2">কোনো সক্রিয় পেমেন্ট পদ্ধতি পাওয়া যায়নি</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">অ্যাকাউন্ট নম্বর</label>
                            <Input
                              value={payoutAccountNumber}
                              onChange={(e) => setPayoutAccountNumber(e.target.value)}
                              placeholder="০১XXXXXXXXX"
                              className="h-10 rounded-xl border-border/50 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">অ্যাকাউন্টের নাম</label>
                          <Input
                            value={payoutAccountName}
                            onChange={(e) => setPayoutAccountName(e.target.value)}
                            placeholder="আপনার নাম"
                            className="h-10 rounded-xl border-border/50 text-sm"
                          />
                        </div>
                        <ActionButton
                          onClick={handlePayoutRequest}
                          loading={payoutLoading}
                          variant="primary"
                          disabled={!payoutAccountType || !payoutAccountNumber || !payoutAccountName || payoutMethods.length === 0}
                        >
                          <Banknote className="h-5 w-5" />
                          পেআউট অনুরোধ করুন
                        </ActionButton>
                      </div>
                    ) : payoutPaid ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 px-4 py-3">
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            পেআউট সম্পন্ন হয়েছে! আপনার একাউন্টে টাকা পাঠানো হয়েছে।
                          </p>
                        </div>
                        {submittedPayoutInfo && (
                          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                            <p className="text-[10px] font-medium text-muted-foreground">জমা দেওয়া একাউন্ট তথ্য</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-[10px] text-muted-foreground">পেমেন্ট মেথড</p>
                                <p className="font-semibold text-foreground">{submittedPayoutInfo.accountType}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">একাউন্ট নম্বর</p>
                                <p className="font-mono font-semibold text-foreground">{submittedPayoutInfo.accountNumber}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">একাউন্টের নাম</p>
                              <p className="text-sm font-semibold text-foreground">{submittedPayoutInfo.accountName}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3">
                          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            পেআউট অনুরোধ জমা হয়েছে। অ্যাডমিন প্রসেসিং করছেন।
                          </p>
                        </div>
                        {submittedPayoutInfo && (
                          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                            <p className="text-[10px] font-medium text-muted-foreground">জমা দেওয়া একাউন্ট তথ্য</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-[10px] text-muted-foreground">পেমেন্ট মেথড</p>
                                <p className="font-semibold text-foreground">{submittedPayoutInfo.accountType}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">একাউন্ট নম্বর</p>
                                <p className="font-mono font-semibold text-foreground">{submittedPayoutInfo.accountNumber}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">একাউন্টের নাম</p>
                              <p className="text-sm font-semibold text-foreground">{submittedPayoutInfo.accountName}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Completed state – Buyer view (no payout needed) */}
                {isCompleted && isBuyer && (
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-5 py-4 border border-emerald-200 dark:border-emerald-500/20">
                    <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      ডিল সফলভাবে সম্পন্ন হয়েছে!
                    </p>
                  </div>
                )}

                {/* Cancelled/Rejected state – Buyer */}
                {isCancelled && isBuyer && (
                  <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      <p className="text-sm font-bold text-red-700 dark:text-red-400">
                        ডিল {status === 'rejected' ? 'রিজেক্ট' : 'বাতিল'} হয়েছে
                      </p>
                    </div>
                    {/* No refund for rejected deals — admin rejected = wrong/invalid transaction */}
                    {status === 'rejected' ? (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          অ্যাডমিন পেমেন্ট ভেরিফিকেশন রিজেক্ট করেছেন। ভুল ট্রানজাকশনের কারণে রিফান্ড প্রযোজ্য নয়। সঠিক তথ্য দিয়ে নতুন ডিল তৈরি করুন।
                        </p>
                      </div>
                    ) : payoutChecking ? (
                      <div className="space-y-3">
                        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                      </div>
                    ) : !payoutSubmitted ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground font-medium">আপনার অর্থ ফেরত পেতে নিচের ফর্ম পূরণ করুন</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">পেমেন্ট পদ্ধতি</label>
                            {payoutMethods.length > 0 ? (
                              <PayoutMethodSelect
                                methods={payoutMethods}
                                value={payoutAccountType}
                                onChange={setPayoutAccountType}
                                locked={dealHasPaymentMethod}
                              />
                            ) : (
                              <p className="text-xs text-amber-600 dark:text-amber-400 py-2">কোনো সক্রিয় পেমেন্ট পদ্ধতি পাওয়া যায়নি</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">অ্যাকাউন্ট নম্বর</label>
                            <Input
                              value={payoutAccountNumber}
                              onChange={(e) => setPayoutAccountNumber(e.target.value)}
                              placeholder="০১XXXXXXXXX"
                              className="h-10 rounded-xl border-border/50 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">অ্যাকাউন্টের নাম</label>
                          <Input
                            value={payoutAccountName}
                            onChange={(e) => setPayoutAccountName(e.target.value)}
                            placeholder="আপনার নাম"
                            className="h-10 rounded-xl border-border/50 text-sm"
                          />
                        </div>
                        <ActionButton
                          onClick={handlePayoutRequest}
                          loading={payoutLoading}
                          variant="primary"
                          disabled={!payoutAccountType || !payoutAccountNumber || !payoutAccountName || payoutMethods.length === 0}
                        >
                          <Banknote className="h-5 w-5" />
                          ফেরতের অনুরোধ করুন
                        </ActionButton>
                      </div>
                    ) : payoutPaid ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 px-4 py-3">
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            ফেরত সম্পন্ন হয়েছে! আপনার একাউন্টে টাকা পাঠানো হয়েছে।
                          </p>
                        </div>
                        {submittedPayoutInfo && (
                          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                            <p className="text-[10px] font-medium text-muted-foreground">জমা দেওয়া একাউন্ট তথ্য</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-[10px] text-muted-foreground">পেমেন্ট মেথড</p>
                                <p className="font-semibold text-foreground">{submittedPayoutInfo.accountType}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">একাউন্ট নম্বর</p>
                                <p className="font-mono font-semibold text-foreground">{submittedPayoutInfo.accountNumber}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">একাউন্টের নাম</p>
                              <p className="text-sm font-semibold text-foreground">{submittedPayoutInfo.accountName}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3">
                          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            ফেরতের অনুরোধ জমা হয়েছে। অ্যাডমিন প্রসেসিং করছেন।
                          </p>
                        </div>
                        {submittedPayoutInfo && (
                          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                            <p className="text-[10px] font-medium text-muted-foreground">জমা দেওয়া একাউন্ট তথ্য</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-[10px] text-muted-foreground">পেমেন্ট মেথড</p>
                                <p className="font-semibold text-foreground">{submittedPayoutInfo.accountType}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">একাউন্ট নম্বর</p>
                                <p className="font-mono font-semibold text-foreground">{submittedPayoutInfo.accountNumber}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">একাউন্টের নাম</p>
                              <p className="text-sm font-semibold text-foreground">{submittedPayoutInfo.accountName}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Cancelled/Rejected state – Seller view (no refund) */}
                {isCancelled && isSeller && (
                  <div className="flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-5 py-4 border border-red-200 dark:border-red-500/20">
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                      ডিল {status === 'rejected' ? 'রিজেক্ট' : 'বাতিল'} হয়েছে
                    </p>
                  </div>
                )}

                {/* Seller: Waiting for payment (status = created, seller view) */}
                {isSeller && status === 'created' && (
                  <div className="flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-5 py-4 border border-amber-200 dark:border-amber-500/20">
                    <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      ক্রেতার পেমেন্টের অপেক্ষায় আছে
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              TAB 2: ডিল চ্যাট (Deal Chat)
              Full-page immersive chat
              ═══════════════════════════════════════ */}
          {activeTab === 'chat' && (
            <motion.div
              key="deal-chat"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex-1 min-h-0 flex flex-col"
            >
              {/* ── Chat Header ── */}
              <div
                className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-border/30"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: PARROT_GREEN_MILD, color: PARROT_GREEN }}
                  >
                    {isBuyer ? 'ক' : 'ব'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isBuyer ? sellerName : buyerName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        অনলাইন
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Chat Messages Area (Glassmorphism Background) ── */}
              <div
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3"
                style={{
                  /* Glassmorphism: subtle pattern + blur */
                  backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(101,163,13,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(101,163,13,0.02) 0%, transparent 50%)',
                  backgroundColor: 'var(--muted)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--border) transparent',
                }}
              >
                {chatLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!chatLoading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: PARROT_GREEN_MILD }}>
                      <MessageCircle className="h-6 w-6" style={{ color: PARROT_GREEN }} />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">কোনো মেসেজ নেই</p>
                    <p className="text-xs text-muted-foreground/70">প্রথম মেসেজ পাঠান!</p>
                  </div>
                )}

                {!chatLoading && messages.length > 0 && (
                  <>
                    <ChatDateDivider text="আজ" />
                    <AnimatePresence initial={false}>
                      {messages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} currentUserId={user?.id} />
                      ))}
                    </AnimatePresence>
                  </>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* ── Chat Input Bar (Fixed Bottom) ── */}
              <div
                className="shrink-0 border-t border-border/30 px-3 sm:px-4 py-3 sm:py-4"
                style={{
                  backgroundColor: 'var(--card)',
                }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Admin ডাকুন button */}
                  <button
                    onClick={handleCallAdmin}
                    disabled={adminCallLoading || dealData?.adminCalled}
                    className="flex items-center gap-1.5 h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: dealData?.adminCalled ? 'hsl(var(--muted))' : 'rgba(239,68,68,0.1)',
                      color: dealData?.adminCalled ? 'hsl(var(--muted-foreground))' : '#ef4444',
                    }}
                    aria-label="অ্যাডমিন ডাকুন"
                  >
                    <Headphones className="h-4 w-4" />
                    <span className="hidden sm:inline">{dealData?.adminCalled ? 'ডাকা হয়েছে' : 'অ্যাডমিন ডাকুন'}</span>
                  </button>

                  {/* Text input */}
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                      placeholder="মেসেজ লিখুন..."
                      className="w-full h-11 rounded-xl border-border/50 bg-muted/40 text-sm pr-12 focus:border-[rgba(101,163,13,0.4)] focus:ring-[rgba(101,163,13,0.15)] transition-colors"
                    />
                  </div>

                  {/* Send button */}
                  <motion.button
                    onClick={handleSend}
                    disabled={!chatInput.trim() || sendingMsg}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 disabled:opacity-40"
                    whileHover={{ scale: chatInput.trim() && !sendingMsg ? 1.08 : 1 }}
                    whileTap={{ scale: chatInput.trim() && !sendingMsg ? 0.92 : 1 }}
                    style={{
                      backgroundColor: chatInput.trim() && !sendingMsg ? PARROT_GREEN : 'var(--muted)',
                      color: chatInput.trim() && !sendingMsg ? '#fff' : 'var(--muted-foreground)',
                      boxShadow: chatInput.trim() && !sendingMsg ? PARROT_GREEN_GLOW : 'none',
                    }}
                    aria-label="পাঠান"
                  >
                    {sendingMsg ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}