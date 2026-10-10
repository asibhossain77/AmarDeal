'use client';

/**
 * Deal Detail — Payment dialogs
 *
 * Migrated 1:1 from the original deal-workflow-tracker.tsx.
 * All API calls, validation, and flows are preserved:
 *  - PipraPayButton    → /api/auth/piprapay-status + /api/payment/piprapay/create-charge
 *  - PaymentDialog     → /api/payment-methods, /api/deals/check-transaction,
 *                        /api/deals/calculate-fee, POST /api/deals/payment
 *  - PayoutRefundDialog → /api/payment-methods, POST /api/deals/[id]/request-payout
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cdnUrl } from '@/lib/cdn-url';
import { LoadingAnimation } from '@/components/shared/loading-animation';
import {
  ArrowLeft,
  Check,
  Banknote,
  Wallet,
  AlertTriangle,
  Info,
  Zap,
  Copy,
  ChevronDown,
  ArrowRight,
  RotateCcw,
  CircleCheckBig,
  SendHorizonal,
} from 'lucide-react';

/* ── PipraPay Auto Payment Button ── */
export function PipraPayButton({ dealId }: { dealId?: string }) {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/piprapay-status')
      .then((r) => r.json())
      .then((d) => setAvailable(!!d.enabled))
      .catch(() => setAvailable(false));
  }, []);

  const handlePipraPay = async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payment/piprapay/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      const data = await res.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast.error(data.error || 'PipraPay পেমেন্ট শুরু করতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  if (available === null) return null;
  if (!available) return null;

  return (
    <button
      onClick={handlePipraPay}
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-sm"
    >
      {loading ? <LoadingAnimation size="sm" /> : <Zap className="h-4 w-4" />}
      {loading ? 'পেমেন্ট হচ্ছে...' : 'PipraPay অটোমেশন'}
    </button>
  );
}

/* ── Manual Payment Dialog ── */
export function PaymentDialog({
  open,
  onOpenChange,
  dealId,
  dealAmount,
  dealPaymentMethod,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId?: string;
  dealAmount?: number;
  dealPaymentMethod?: { id: string; name: string; accountType: string } | null;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'select' | 'pay'>('select');
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string; accountNumber: string; accountType: string; color: string; image: string | null; instructions?: string | null; qrImage?: string | null }[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [txnDuplicate, setTxnDuplicate] = useState<{ title: string; status: string } | null>(null);
  const [txnChecking, setTxnChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullInstructions, setShowFullInstructions] = useState(false);

  // Real-time duplicate transaction ID check (debounced on change, also on blur)
  useEffect(() => {
    if (!open || !transactionId.trim()) { setTxnDuplicate(null); return; }
    const tid = transactionId.trim();
    setTxnChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/deals/check-transaction?tid=${encodeURIComponent(tid)}&dealId=${dealId || ''}`);
        if (res.ok) {
          const data = await res.json();
          if (data.exists) setTxnDuplicate({ title: data.deal.title, status: data.deal.status });
          else setTxnDuplicate(null);
        }
      } catch { /* silent */ }
      finally { setTxnChecking(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [open, transactionId, dealId]);

  // Fetch payment methods on open
  useEffect(() => {
    if (!open) return;
    setStep('select');
    fetch('/api/payment-methods')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setPaymentMethods(data);
        if (data.length === 0) return;
        // If deal already has a method, auto-advance to pay step
        if (dealPaymentMethod?.id && data.some((m: { id: string }) => m.id === dealPaymentMethod.id)) {
          setSelectedMethodId(dealPaymentMethod.id);
          setStep('pay');
        }
      })
      .catch(() => {});
    // Reset form
    setSenderNumber('');
    setTransactionId('');
    const initAmount = dealAmount ? String(dealAmount) : '';
    setAmount(initAmount);
    setFee(null);
    // Fetch fee for pre-filled amount
    const num = parseFloat(initAmount);
    if (num && num > 0) {
      fetch(`/api/deals/calculate-fee?amount=${num}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.fee !== undefined) setFee(d.fee); })
        .catch(() => {});
    }
  }, [open, dealPaymentMethod?.id, dealAmount]);

  // Handle method selection → go to pay step
  const handleMethodSelect = (methodId: string) => {
    setSelectedMethodId(methodId);
    setShowFullInstructions(false);
    setCopied(false);
    // Small delay for visual feedback, then advance
    setTimeout(() => setStep('pay'), 200);
  };

  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId);
  // Fallback must be a real hex so the alpha-suffix tints (${color}14 etc.) stay valid
  const themeColor = selectedMethod?.color || '#6366f1';
  const total = (parseFloat(amount) || 0) + (fee || 0);
  const numAmount = parseFloat(amount) || 0;

  const copyAccountNumber = async () => {
    if (!selectedMethod) return;
    try {
      await navigator.clipboard.writeText(selectedMethod.accountNumber);
      setCopied(true);
      toast.success('নম্বর কপি হয়েছে!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('কপি করা যায়নি — ম্যানুয়ালি সিলেক্ট করুন');
    }
  };

  const handleSubmit = async () => {
    if (!dealId || !senderNumber.trim() || !transactionId.trim()) {
      toast.error('সকল তথ্য প্রদান করুন');
      return;
    }
    // Block submit if duplicate transaction is detected
    if (txnDuplicate) {
      setSubmitError('এই ট্রানজেকশন আইডি আগেই ব্যবহার করা হয়েছে ("' + txnDuplicate.title + '")। অনুগ্রহ করে নতুন ট্রানজেকশন আইডি দিন।');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/deals/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          paymentMethodId: selectedMethodId || undefined,
          senderNumber: senderNumber.trim(),
          transactionId: transactionId.trim(),
          amount: parseFloat(amount) || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('পেমেন্ট সফলভাবে জমা হয়েছে!');
        onOpenChange(false);
        onSuccess();
      } else {
        setSubmitError(data.error || 'পেমেন্ট জমা করতে সমস্যা হয়েছে');
        toast.error(data.error || 'পেমেন্ট জমা করতে সমস্যা হয়েছে');
      }
    } catch {
      setSubmitError('সার্ভারে সমস্যা হয়েছে');
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid grid-rows-[minmax(0,1fr)] gap-0 p-0 overflow-hidden w-full max-w-md max-h-[92dvh] shadow-2xl
          top-auto bottom-0 left-0 right-0 translate-x-0 translate-y-0 rounded-t-3xl rounded-b-none border-0 duration-300
          sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%]
          sm:rounded-3xl sm:border sm:max-h-[86vh] sm:max-w-md"
      >
        <AnimatePresence mode="wait">
        {/* ──────── STEP 1: Payment Method Selection ──────── */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex min-h-0 flex-col"
          >
            {/* Header — compact, themed */}
            <div className="relative shrink-0 px-5 pb-4 pt-5" style={{ background: `linear-gradient(160deg, ${themeColor}14 0%, transparent 65%)` }}>
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-base font-bold sm:text-lg">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm" style={{ backgroundColor: themeColor + '1f' }}>
                    <Wallet className="h-5 w-5" style={{ color: themeColor }} />
                  </div>
                  <span className="min-w-0">
                    <span className="block truncate">পেমেন্ট মাধ্যম নির্বাচন করুন</span>
                    <DialogDescription className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                      আপনার পছন্দের মাধ্যমে পেমেন্ট করুন
                    </DialogDescription>
                  </span>
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Method List — scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-1">
              {paymentMethods.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <Wallet className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">কোনো পেমেন্ট মাধ্যম পাওয়া যায়নি</p>
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {paymentMethods.map((m) => {
                    const mc = m.color || '#6b7280';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleMethodSelect(m.id)}
                        className="group relative flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-[0.98]"
                        style={{
                          borderColor: mc + '2b',
                          background: `linear-gradient(135deg, ${mc}12 0%, ${mc}05 100%)`,
                        }}
                      >
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: mc + '1f' }}>
                          <Wallet className="h-5 w-5" style={{ color: mc }} />
                          {m.image && (
                            <img
                              src={cdnUrl(m.image) || ''}
                              alt=""
                              loading="lazy" decoding="async"
                              className="absolute inset-0 h-full w-full rounded-xl object-contain p-1.5"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold text-foreground">{m.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {m.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'} নম্বর
                          </p>
                        </div>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5" style={{ backgroundColor: mc + '1a' }}>
                          <ArrowRight className="h-3.5 w-3.5" style={{ color: mc }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ──────── STEP 2: Payment Form ──────── */}
        {step === 'pay' && selectedMethod && (
          <motion.div
            key="pay"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex min-h-0 flex-col"
          >
            {/* Sticky themed header */}
            <div className="relative shrink-0 px-4 pb-3.5 pt-4" style={{ background: `linear-gradient(160deg, ${themeColor}16 0%, transparent 70%)` }}>
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-base font-bold sm:text-lg">
                  <button
                    type="button"
                    onClick={() => setStep('select')}
                    aria-label="মাধ্যম পরিবর্তন করুন"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/5 transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    <ArrowLeft className="h-4 w-4 text-foreground/70" />
                  </button>
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: themeColor + '20' }}>
                    <Wallet className="h-4 w-4" style={{ color: themeColor }} />
                    {selectedMethod.image && (
                      <img
                        src={cdnUrl(selectedMethod.image) || ''}
                        alt=""
                        loading="lazy" decoding="async"
                        className="absolute inset-0 h-full w-full rounded-xl object-contain p-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate pr-6">{selectedMethod.name}</span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  নিচের নম্বরে টাকা পাঠান এবং তথ্য দিন
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Scrollable middle — header & footer always stay visible */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">
              {/* Account Number — prominent + one-tap copy */}
              <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: themeColor + '0d', border: `1.5px solid ${themeColor}2b` }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: themeColor, opacity: 0.75 }}>
                    {selectedMethod.name} এ পাঠান
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedMethod.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'} নম্বর
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <p
                    className="min-w-0 flex-1 select-all truncate font-mono text-xl font-extrabold leading-tight tracking-[0.08em] sm:text-2xl"
                    style={{ color: themeColor }}
                  >
                    {selectedMethod.accountNumber}
                  </p>
                  <button
                    type="button"
                    onClick={copyAccountNumber}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition-all active:scale-95"
                    style={{ backgroundColor: themeColor + '1a', color: themeColor }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'কপি হয়েছে' : 'কপি'}
                  </button>
                </div>
              </div>

              {/* QR / Instruction Image — compact row with explainer */}
              {selectedMethod.qrImage && (
                <div className="flex items-center gap-3.5 rounded-2xl p-2.5" style={{ backgroundColor: themeColor + '08', border: `1.5px solid ${themeColor}20` }}>
                  <a
                    href={cdnUrl(selectedMethod.qrImage) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/5 transition-transform active:scale-[0.97]"
                    title="বড় করে দেখতে ক্লিক করুন"
                  >
                    <img
                      src={cdnUrl(selectedMethod.qrImage) || ''}
                      alt={`${selectedMethod.name} QR কোড`}
                      className="h-24 w-24 object-contain"
                      loading="lazy" decoding="async"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        el.parentElement?.classList.add('hidden');
                      }}
                    />
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold text-foreground">QR স্ক্যান করুন</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      ক্যামেরা দিয়ে QR স্ক্যান করে সরাসরি টাকা পাঠান। বড় করে দেখতে QR-এ ক্লিক করুন।
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Instructions — from admin panel (collapsible to save space) */}
              {selectedMethod.instructions?.trim() && (
                <div className="rounded-2xl px-3.5 py-3" style={{ backgroundColor: themeColor + '0d', border: `1.5px dashed ${themeColor}40` }}>
                  <button
                    type="button"
                    onClick={() => setShowFullInstructions((v) => !v)}
                    className="flex w-full items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: themeColor }}>
                      <Info className="h-3.5 w-3.5" />
                      পেমেন্ট করার নিয়ম
                    </span>
                    {selectedMethod.instructions.trim().length > 90 && (
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${showFullInstructions ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  <p className={`mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-foreground ${!showFullInstructions && selectedMethod.instructions.trim().length > 90 ? 'line-clamp-3' : ''}`}>
                    {selectedMethod.instructions.trim()}
                  </p>
                </div>
              )}

              {/* Fixed Amount + Fee + Total Summary */}
              {numAmount > 0 && (
                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: themeColor + '20', backgroundColor: themeColor + '08' }}>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">ডিল পরিমাণ</span>
                    <span className="text-sm font-semibold text-foreground">৳{Math.round(numAmount).toLocaleString('en')}</span>
                  </div>
                  {fee !== null && fee > 0 && (
                    <div className="flex items-center justify-between border-t px-4 py-2.5" style={{ borderColor: themeColor + '15' }}>
                      <span className="text-xs text-muted-foreground">প্ল্যাটফর্ম ফি</span>
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">+ ৳{Math.round(fee).toLocaleString('en')}</span>
                    </div>
                  )}
                  <div
                    className="flex items-center justify-between border-t px-4 py-3"
                    style={{ borderColor: themeColor + '30', backgroundColor: themeColor + '10' }}
                  >
                    <span className="text-sm font-bold text-foreground">মোট প্রদান</span>
                    <span className="text-lg font-extrabold" style={{ color: themeColor }}>
                      ৳{Math.round(total).toLocaleString('en')}
                    </span>
                  </div>
                </div>
              )}

              {/* Sender Number */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">আপনার {selectedMethod.name} নম্বর</Label>
                <Input
                  placeholder="01XXXXXXXXX"
                  inputMode="tel"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Transaction ID */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">ট্রানজেকশন আইডি / রেফারেন্স</Label>
                <div className="relative">
                  <Input
                    placeholder="যেমন: 9HVX7B2KQZ"
                    value={transactionId}
                    onChange={(e) => { setTransactionId(e.target.value); setSubmitError(''); }}
                    className={`h-11 rounded-xl pr-9 ${txnDuplicate ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                  />
                  {txnChecking && (
                    <LoadingAnimation size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                {txnDuplicate && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3.5 py-2.5"
                  >
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-red-700 dark:text-red-400">এই ট্রানজেকশন আইডি আগেই ব্যবহার করা হয়েছে!</p>
                      <p className="text-[10px] text-red-600/80 dark:text-red-400/70 mt-0.5">ডিল: &quot;{txnDuplicate.title}&quot; ({txnDuplicate.status})</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Inline Error — always visible right above the footer */}
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 shrink-0 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3.5 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <p className="text-[11px] font-medium text-red-700 dark:text-red-400">{submitError}</p>
                </div>
              </motion.div>
            )}

            {/* Sticky Footer — always on screen */}
            <div className="shrink-0 border-t border-border/50 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  className="h-11 shrink-0 rounded-xl px-4"
                  onClick={() => setStep('select')}
                  aria-label="মাধ্যম পরিবর্তন করুন"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">পরিবর্তন</span>
                </Button>
                <Button
                  className="h-11 min-w-0 flex-1 gap-2 rounded-xl text-[15px] font-bold"
                  style={{ backgroundColor: themeColor, borderColor: themeColor }}
                  onClick={handleSubmit}
                  disabled={submitting || !senderNumber.trim() || !transactionId.trim() || !!txnDuplicate}
                >
                  {submitting ? (
                    <LoadingAnimation size="sm" />
                  ) : (
                    <SendHorizonal className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {submitting
                      ? 'জমা হচ্ছে...'
                      : total > 0
                        ? `পেমেন্ট জমা দিন • ৳${Math.round(total).toLocaleString('en')}`
                        : 'পেমেন্ট জমা দিন'}
                  </span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/* ── Payout / Refund Gateway Dialog ── */
export function PayoutRefundDialog({
  open,
  onOpenChange,
  dealId,
  dealTitle,
  dealAmount,
  dealPaymentAmount,
  dealPlatformFee,
  dealPaymentMethod,
  type, // 'seller_payout' | 'buyer_refund'
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId?: string;
  dealTitle?: string;
  dealAmount?: number;
  dealPaymentAmount?: number | null;
  dealPlatformFee?: number | null;
  dealPaymentMethod?: { id: string; name: string; accountType: string; color?: string } | null;
  type: 'seller_payout' | 'buyer_refund';
  onSuccess: () => void;
}) {
  const isPayout = type === 'seller_payout';
  const [step, setStep] = useState<'select' | 'form' | 'success'>('select');
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string; accountType: string; color: string }[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Payout amount = full deal amount (fee is paid by buyer on top, not deducted from seller)
  const baseAmount = dealPaymentAmount || dealAmount || 0;
  const payoutAmount = baseAmount;

  // Fetch payment methods on open
  useEffect(() => {
    if (!open) return;
    setStep('select');
    setAccountNumber('');
    setAccountName('');
    fetch('/api/payment-methods')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setPaymentMethods(data);
        if (data.length === 0) return;
        // If deal already has a method, auto-advance to form step
        if (dealPaymentMethod?.id && data.some((m: { id: string }) => m.id === dealPaymentMethod.id)) {
          setSelectedMethodId(dealPaymentMethod.id);
          setTimeout(() => setStep('form'), 150);
        }
      })
      .catch(() => {});
  }, [open, dealPaymentMethod?.id]);

  const handleMethodSelect = (methodId: string) => {
    setSelectedMethodId(methodId);
    setTimeout(() => setStep('form'), 200);
  };

  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId);
  const themeColor = selectedMethod?.color || (isPayout ? '#65A30D' : '#EF4444');

  const handleSubmit = async () => {
    if (!dealId || !accountNumber.trim() || !accountName.trim() || !selectedMethod) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/request-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: selectedMethod.name,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep('success');
        onSuccess();
      } else {
        setSubmitError(data.error || (isPayout ? 'পেআউট অনুরোধে সমস্যা' : 'ফেরতের অনুরোধে সমস্যা'));
        toast.error(data.error || (isPayout ? 'পেআউট অনুরোধে সমস্যা' : 'ফেরতের অনুরোধে সমস্যা'));
      }
    } catch {
      setSubmitError('সার্ভারে সমস্যা হয়েছে');
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ──────── STEP 1: Method Selection ──────── */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-6 pt-6 pb-3">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: themeColor + '15' }}
                    >
                      {isPayout ? (
                        <Banknote className="h-5 w-5" style={{ color: themeColor }} />
                      ) : (
                        <RotateCcw className="h-5 w-5" style={{ color: themeColor }} />
                      )}
                    </div>
                    {isPayout ? 'পেআউট মাধ্যম নির্বাচন' : 'ফেরত মাধ্যম নির্বাচন'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                    আপনার যে মাধ্যমে টাকা পেতে চান সেটি নির্বাচন করুন
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="px-5 pb-6">
                {paymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">কোনো পেমেন্ট মাধ্যম পাওয়া যায়নি</p>
                ) : (
                  <div className="grid gap-3 mt-2">
                    {paymentMethods.map((m) => {
                      const mc = m.color || '#6b7280';
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleMethodSelect(m.id)}
                          className="group relative flex items-center gap-4 rounded-2xl border border-border/50 p-4 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg"
                          style={{
                            borderColor: 'transparent',
                            background: `linear-gradient(135deg, ${mc}12 0%, ${mc}06 100%)`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = mc + '50';
                            e.currentTarget.style.boxShadow = `0 8px 25px ${mc}18`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm"
                            style={{ backgroundColor: mc + '20' }}
                          >
                            <Wallet className="h-5.5 w-5.5" style={{ color: mc }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold text-foreground">{m.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {m.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'} নম্বর
                            </p>
                          </div>
                          <ArrowRight
                            className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1"
                            style={{ color: mc + '80' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ──────── STEP 2: Form ──────── */}
          {step === 'form' && selectedMethod && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Themed Header */}
              <div
                className="px-6 pt-6 pb-4"
                style={{ background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)` }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                    <button
                      type="button"
                      onClick={() => setStep('select')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: themeColor + '20' }}
                    >
                      {isPayout ? (
                        <Banknote className="h-4.5 w-4.5" style={{ color: themeColor }} />
                      ) : (
                        <RotateCcw className="h-4.5 w-4.5" style={{ color: themeColor }} />
                      )}
                    </div>
                    {isPayout ? 'পেআউট অনুরোধ' : 'ফেরতের অনুরোধ'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {isPayout ? 'আপনার পেমেন্ট পেতে নিচের তথ্য দিন' : 'আপনার অর্থ ফেরত পেতে নিচের তথ্য দিন'}
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Amount Summary */}
              <div
                className="mx-5 mt-4 rounded-2xl px-5 py-4"
                style={{
                  backgroundColor: themeColor + '0d',
                  border: `1.5px solid ${themeColor}30`,
                }}
              >
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                  {isPayout ? 'আপনি পাবেন' : 'ফেরত পাবেন'}
                </p>
                <p
                  className="text-2xl font-extrabold tracking-tight leading-tight"
                  style={{ color: themeColor }}
                >
                  ৳{Math.round(payoutAmount).toLocaleString('en')}
                </p>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: themeColor + '20' }}>
                  <Wallet className="h-3 w-3" style={{ color: themeColor + 'aa' }} />
                  <span className="text-[11px] font-medium" style={{ color: themeColor + 'cc' }}>
                    {selectedMethod.name} — {selectedMethod.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'}
                  </span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="px-6 py-5 space-y-4 max-h-[45vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">আপনার {selectedMethod.name} নম্বর</Label>
                  <Input
                    placeholder="০১XXXXXXXXX"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">অ্যাকাউন্টের নাম</Label>
                  <Input
                    placeholder="আপনার নাম"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              {/* Inline Error Message */}
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-6 mt-2 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3.5 py-2.5"
                >
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-red-700 dark:text-red-400">{submitError}</p>
                </motion.div>
              )}

              {/* Footer */}
              <div className="border-t border-border/50 px-6 py-4 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => setStep('select')}
                  disabled={!!dealPaymentMethod?.id}
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  পরিবর্তন
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl font-semibold gap-2"
                  style={{ backgroundColor: themeColor, borderColor: themeColor }}
                  onClick={handleSubmit}
                  disabled={submitting || !accountNumber.trim() || !accountName.trim()}
                >
                  {submitting ? (
                    <LoadingAnimation size="sm" />
                  ) : isPayout ? (
                    <Banknote className="h-4 w-4" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  {submitting
                    ? 'জমা হচ্ছে...'
                    : isPayout
                    ? 'পেআউট অনুরোধ'
                    : 'ফেরতের অনুরোধ'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ──────── STEP 3: Success ──────── */}
          {step === 'success' && selectedMethod && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="px-6 py-10 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: themeColor + '15' }}
              >
                <CircleCheckBig className="h-8 w-8" style={{ color: themeColor }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-lg font-bold text-foreground">
                  {isPayout ? 'পেআউট অনুরোধ সফল!' : 'ফেরতের অনুরোধ সফল!'}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  অ্যাডমিন যাচাই করে আপনার একাউন্টে টাকা পাঠাবেন
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-5 rounded-2xl px-5 py-4 text-left"
                style={{
                  backgroundColor: themeColor + '0d',
                  border: `1.5px solid ${themeColor}30`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">পেমেন্ট মাধ্যম</span>
                  <span className="text-xs font-semibold text-foreground">{selectedMethod.name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">একাউন্ট নম্বর</span>
                  <span className="text-xs font-mono font-semibold text-foreground">{accountNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">একাউন্টের নাম</span>
                  <span className="text-xs font-semibold text-foreground">{accountName}</span>
                </div>
                <div className="border-t mt-3 pt-3 flex items-center justify-between" style={{ borderColor: themeColor + '20' }}>
                  <span className="text-xs font-bold text-foreground">{isPayout ? 'পেআউট পরিমাণ' : 'ফেরতের পরিমাণ'}</span>
                  <span className="text-sm font-extrabold" style={{ color: themeColor }}>
                    ৳{Math.round(payoutAmount).toLocaleString('en')}
                  </span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-5"
              >
                <Button
                  className="h-11 rounded-xl font-semibold px-8"
                  style={{ backgroundColor: themeColor, borderColor: themeColor }}
                  onClick={() => onOpenChange(false)}
                >
                  ঠিক আছে
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
