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
  SendHorizonal,
  Shield,
  Loader2,
  PackageCheck,
  AlertTriangle,
  XCircle,
  Ban,
} from 'lucide-react';

const emptySubscribe = () => () => {};

/* ═══════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════ */

const STEPS = [
  { num: '১', label: 'ডিল তৈরি', icon: FileCheck, statusKey: 'created' as const },
  { num: '২', label: 'পেমেন্ট', icon: Send, statusKey: 'payment_pending' as const },
  { num: '৩', label: 'ভেরিফিকেশন', icon: ShieldCheck, statusKey: 'payment_verified' as const },
  { num: '৪', label: 'ডেলিভারি', icon: Truck, statusKey: 'in_delivery' as const },
  { num: '৫', label: 'ডিল সম্পন্ন', icon: ThumbsUp, statusKey: 'completed' as const },
];

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

function getStatusBadge(status: string) {
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
   Stepper Components
   ═══════════════════════════════════════════════════════════ */

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
    <div className="relative flex items-start justify-between">
      <div className="absolute top-[18px] left-[18px] right-[18px] h-[3px] rounded-full bg-border/60" />
      {activeStep >= 0 && (
        <div
          className="absolute top-[18px] left-[18px] h-[3px] rounded-full transition-all duration-700"
          style={{
            width: activeStep >= STEPS.length - 1
              ? 'calc(100% - 36px)'
              : `calc(${(activeStep / (STEPS.length - 1)) * 100}% - 18px)`,
            backgroundColor: isDisputed ? '#EF4444' : '#84CC16',
          }}
        />
      )}

      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = i < activeStep;
        const isActive = i === activeStep;

        return (
          <div key={step.num} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / STEPS.length}%` }}>
            <div className="relative">
              {isActive && (
                <>
                  <span className="absolute -inset-2.5 rounded-full border-2 animate-ping opacity-30" style={{ borderColor: isDisputed ? '#EF4444' : '#84CC16' }} />
                  <span className="absolute -inset-1.5 rounded-full border-2 animate-pulse" style={{ borderColor: isDisputed ? '#EF444440' : '#84CC1640' }} />
                </>
              )}
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] transition-all duration-300"
                style={{
                  backgroundColor: isCompleted || isActive ? (isDisputed && isActive ? '#FEE2E2' : '#84CC16') : 'var(--background)',
                  borderColor: isCompleted || isActive ? (isDisputed && isActive ? '#EF4444' : '#84CC16') : 'var(--border)',
                  color: isCompleted ? '#18181b' : (isActive && isDisputed ? '#EF4444' : (isActive ? '#18181b' : 'var(--muted-foreground)')),
                  boxShadow: (isCompleted || isActive) && !isDisputed ? '0 4px 14px rgba(163,230,53,0.35)' : 'none',
                }}
              >
                {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : isActive && isDisputed ? <AlertTriangle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px] font-semibold leading-tight" style={{ color: isCompleted || isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function VerticalStepper({ activeStep, isDisputed, isCancelled }: { activeStep: number; isDisputed: boolean; isCancelled: boolean }) {
  if (isCancelled) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-6 py-4 border border-red-200 dark:border-red-500/20 w-full">
          <Ban className="h-8 w-8 text-red-500 shrink-0" />
          <div>
            <p className="text-base font-bold text-red-700 dark:text-red-400">ডিল বাতিল হয়েছে</p>
            <p className="text-sm text-red-600/70 dark:text-red-400/70">এই ডিল আর সক্রিয় নয়</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
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
                  <span className="absolute -inset-2 rounded-full border-2 animate-pulse" style={{ borderColor: isDisputed ? '#EF444440' : '#84CC1640' }} />
                )}
                <div
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] transition-all duration-300"
                  style={{
                    backgroundColor: isCompleted || isActive ? (isDisputed && isActive ? '#FEE2E2' : '#84CC16') : 'var(--background)',
                    borderColor: isCompleted || isActive ? (isDisputed && isActive ? '#EF4444' : '#84CC16') : 'var(--border)',
                    color: isCompleted ? '#18181b' : (isActive && isDisputed ? '#EF4444' : (isActive ? '#18181b' : 'var(--muted-foreground)')),
                    boxShadow: (isCompleted || isActive) && !isDisputed ? '0 4px 14px rgba(163,230,53,0.35)' : 'none',
                  }}
                >
                  {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : isActive && isDisputed ? <AlertTriangle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
              </div>
              {!isLast && (
                <div className="w-[3px] flex-1 min-h-8 my-1.5 rounded-full">
                  <div className="h-full w-full rounded-full transition-colors" style={{ backgroundColor: isCompleted ? '#84CC16' : 'var(--border)' }} />
                </div>
              )}
            </div>
            <div className={`flex flex-col justify-center ${isLast ? '' : 'pb-4'}`}>
              <p className="text-sm font-semibold leading-tight" style={{ color: isCompleted || isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                {step.label}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>ধাপ {step.num}</span>
                {isCompleted && <span className="text-xs font-medium" style={{ color: '#84CC16' }}>সম্পন্ন</span>}
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
                    <AlertTriangle className="h-3 w-3" /> বিরোধ
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Detail Card
   ═══════════════════════════════════════════════════════════ */

function DetailCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#84CC1620', color: '#84CC16' }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
        <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   API Deal Data Type
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
  buyer: { id: string; name: string; email: string; phone: string } | null;
  seller: { id: string; name: string; email: string; phone: string } | null;
  creator: { id: string; name: string; email: string } | null;
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export function SellerDealTracker() {
  const { setSellerPanel, activeDeal, user } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [dealData, setDealData] = useState<DealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  if (!mounted) return null;

  const status = dealData?.status || activeDeal?.status || 'created';
  const activeStep = statusToActiveStep(status);
  const isDisputed = status === 'disputed';
  const isCancelled = status === 'cancelled' || status === 'rejected';
  const isCompleted = status === 'completed';

  const dealAmount = dealData?.amount ?? activeDeal?.amount ?? 0;
  const dealTitle = dealData?.title || activeDeal?.title || 'ডিল';
  const dealDate = (dealData?.createdAt || activeDeal?.createdAt)
    ? new Date(dealData?.createdAt || activeDeal?.createdAt || '').toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })
    : '---';
  const buyerName = dealData?.buyer?.name || activeDeal?.buyerName || 'ক্রেতা';
  const sellerName = dealData?.seller?.name || activeDeal?.sellerName || user?.name || 'বিক্রেতা';
  const dealTerms = dealData?.terms;

  const userId = user?.id;
  const isSeller = userId === (dealData?.sellerId) || userId === activeDeal?.sellerId;

  /* ── Action Handlers ── */
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

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-2xl"
    >
      <div className="overflow-hidden rounded-xl border shadow-lg" style={{ backgroundColor: 'var(--background, #fff)', borderColor: 'var(--border)' }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSellerPanel('active-deals')}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
              aria-label="ফিরে যান"
            >
              <ArrowLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md" style={{ backgroundColor: '#84CC16' }}>
                <span className="text-sm font-bold" style={{ color: '#18181b' }}>আ</span>
              </div>
              <span className="text-base font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                আমার ডিল
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs font-medium truncate max-w-[100px]" style={{ color: 'var(--muted-foreground)' }}>
              {user?.name || 'বিক্রেতা'}
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: '#84CC1625', color: '#84CC16' }}>
              {user?.name?.charAt(0) || 'ব'}
            </div>
          </div>
        </div>

        {/* ── Deal Info Content ── */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Deal title + status badge */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                {dealTitle}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                DL-{(dealData?.id || activeDeal?.id || '').slice(-5)}
              </p>
            </div>
            {getStatusBadge(status)}
          </div>

          {/* 5-Step Progress Bar */}
          <div className="py-2">
            <div className="hidden md:block">
              <HorizontalStepper activeStep={activeStep} isDisputed={isDisputed} isCancelled={isCancelled} />
            </div>
            <div className="md:hidden">
              <VerticalStepper activeStep={activeStep} isDisputed={isDisputed} isCancelled={isCancelled} />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailCard icon={Banknote} label="ডিলের পরিমাণ" value={`৳${dealAmount.toLocaleString('bn-BD')}`} />
            <DetailCard icon={User} label="ক্রেতা" value={buyerName} />
            <DetailCard icon={User} label="বিক্রেতা" value={sellerName} />
            <DetailCard icon={CalendarDays} label="তৈরির তারিখ" value={dealDate} />
          </div>

          {/* Deal Terms */}
          {dealTerms && (
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center gap-2 mb-2">
                <ScrollText className="h-4 w-4" style={{ color: '#84CC16' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>ডিলের শর্তাবলী</h3>
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--muted-foreground)' }}>{dealTerms}</p>
            </div>
          )}

          {/* ═══════════════════════════════════════
              SELLER CONDITIONAL ACTION BUTTONS
              ═══════════════════════════════════════ */}

          {/* Seller: Waiting for payment (status = created) */}
          {isSeller && status === 'created' && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-5 py-3 border border-amber-200 dark:border-amber-500/20 w-full justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  ক্রেতার পেমেন্টের অপেক্ষায় আছে
                </p>
              </div>
            </div>
          )}

          {/* Seller: Waiting for verification (status = payment_pending) */}
          {isSeller && status === 'payment_pending' && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-5 py-3 border border-amber-200 dark:border-amber-500/20 w-full justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  পেমেন্ট ভেরিফিকেশনের অপেক্ষায় আছে
                </p>
              </div>
            </div>
          )}

          {/* Seller: Deliver + Cancel buttons (status = payment_verified) */}
          {isSeller && status === 'payment_verified' && (
            <div className="space-y-3">
              <p className="text-sm text-center font-medium text-muted-foreground">
                পেমেন্ট ভেরিফাই হয়েছে। পণ্য/সেবা ডেলিভারি করুন।
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleDeliver}
                  disabled={actionLoading}
                  className="flex-1 h-12 rounded-xl text-base font-bold gap-2.5 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    backgroundColor: '#84CC16',
                    color: '#18181b',
                    boxShadow: '0 6px 24px rgba(163,230,53,0.3)',
                  }}
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}
                  কাজ সম্পন্ন
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl text-base font-semibold gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                  ক্যান্সেল করুন
                </Button>
              </div>
            </div>
          )}

          {/* Seller: Waiting for buyer confirmation (status = in_delivery) */}
          {isSeller && status === 'in_delivery' && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 dark:bg-primary/15 px-5 py-3 border border-primary/20 w-full justify-center">
                <Truck className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  ক্রেতার নিশ্চিতকরণের অপেক্ষায় আছে
                </p>
              </div>
            </div>
          )}

          {/* Disputed state */}
          {isDisputed && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 px-5 py-3 border border-red-200 dark:border-red-500/20 w-full justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  বিরোধ দায়ের করা হয়েছে। অ্যাডমিন পর্যালোচনা করছেন।
                </p>
              </div>
            </div>
          )}

          {/* Completed state */}
          {isCompleted && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-5 py-3 border border-emerald-200 dark:border-emerald-500/20 w-full justify-center">
                <Check className="h-5 w-5 text-emerald-500" />
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  ডিল সফলভাবে সম্পন্ন হয়েছে!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}