'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Phone,
  Hash,
  ShieldCheck,
  CreditCard,
  Building2,
  Wallet,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';

/* ─── Types ─── */
interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  accountType: string;
  color: string;
  image: string | null;
}

interface FeeCalc {
  amount: number;
  fee: number;
  total: number;
  feePercentage: number;
  matchedRule: {
    minimum_amount: number;
    maximum_amount: number;
    fee: number;
  } | null;
}

/* ─── Color Utility ─── */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#18181b' : '#ffffff';
}

/* ─── Method icon/image helper ─── */
function getMethodIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('bkash')) return Wallet;
  if (lower.includes('nagad')) return CreditCard;
  if (lower.includes('rocket')) return Wallet;
  if (lower.includes('bank')) return Building2;
  return CreditCard;
}

/* ─── Component ─── */
export function UserPaymentView() {
  const activeDeal = useAppStore((s) => s.activeDeal);
  const { setDashboardPanel, setActiveDeal } = useAppStore();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [feeCalc, setFeeCalc] = useState<FeeCalc | null>(null);
  const [loading, setLoading] = useState(true);
  const [senderNumber, setSenderNumber] = useState('');
  const [txnId, setTxnId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | false>(false);
  const [showSuccess, setShowSuccess] = useState(false);

  /* ─── Fetch data ─── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [methodsRes, feeRes] = await Promise.all([
        fetch('/api/payment-methods'),
        activeDeal ? fetch(`/api/deals/calculate-fee?amount=${activeDeal.amount}`) : Promise.resolve(null),
      ]);

      if (methodsRes.ok) {
        const methodsData = await methodsRes.json();
        setMethods(methodsData);
        if (methodsData.length > 0 && !selectedId) {
          setSelectedId(methodsData[0].id);
        }
      }

      if (feeRes?.ok) {
        const feeData: FeeCalc = await feeRes.json();
        setFeeCalc(feeData);
      }
    } catch {
      toast.error('পেমেন্ট তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [activeDeal?.amount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Derived ─── */
  const selectedMethod = methods.find((m) => m.id === selectedId);
  const amount = activeDeal?.amount ?? 0;
  const fee = feeCalc?.fee ?? 0;
  const totalAmount = feeCalc?.total ?? amount;
  const feePercentage = feeCalc?.feePercentage ?? 0;
  const activeColor = selectedMethod?.color || '#84CC16';
  const contrastColor = getContrastColor(activeColor);

  const canConfirm =
    selectedId !== '' && senderNumber.trim() !== '' && txnId.trim() !== '';

  /* ─── Handlers ─── */
  const handleConfirm = async () => {
    if (!canConfirm || !activeDeal || !selectedMethod) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/deals/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: activeDeal.id,
          paymentMethodId: selectedMethod.id,
          senderNumber: senderNumber.trim(),
          transactionId: txnId.trim(),
          amount: totalAmount,
          fee,
        }),
      });

      if (res.ok) {
        setShowSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'পেমেন্ট জমা করতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Success Popup ─── */
  if (showSuccess) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-sm mx-4 rounded-3xl bg-white dark:bg-zinc-900 border border-border/40 shadow-2xl dark:shadow-none p-6 sm:p-8 text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">
            পেমেন্ট জমা হয়েছে!
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            আপনার পেমেন্ট জমা হয়েছে। অ্যাডমিন ভেরিফাইয়ের অপেক্ষায় আছে।
          </p>
          <Button
            onClick={() => {
              setShowSuccess(false);
              setActiveDeal(null);
              setDashboardPanel('my-deals');
            }}
            className="mt-6 w-full h-11 rounded-xl font-semibold gap-2"
          >
            ডিল দেখুন
          </Button>
        </motion.div>
      </div>
    );
  }

  /* ─── No active deal ─── */
  if (!activeDeal) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <CreditCard className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-lg font-medium text-muted-foreground">
          কোনো সক্রিয় ডিল নেই
        </p>
        <Button
          variant="outline"
          onClick={() => setDashboardPanel('overview')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          ফিরে যান
        </Button>
      </div>
    );
  }

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-3 w-48 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-20 rounded-xl bg-white dark:bg-zinc-900 shadow-lg animate-pulse" />
        <div className="h-32 rounded-xl bg-white dark:bg-zinc-900 shadow-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 flex-1 min-h-0">
      {/* ── Wrong Info Warning ── */}
      {activeDeal?.rejectionReason === 'wrong_info' && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3.5 border border-amber-200 dark:border-amber-500/20 shrink-0">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              আপনার পেমেন্ট তথ্যে ভুল পাওয়া গেছে
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500/80">
              অনুগ্রহ করে সঠিক তথ্য দিয়ে আবার পেমেন্ট করুন। এই কারণে রিফান্ড হবে না।
            </p>
          </div>
        </div>
      )}

      {/* ── Top Section: Back Button + Title ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setActiveDeal(null); setDashboardPanel('my-deals'); }}
          className="h-9 w-9 rounded-xl hover:bg-accent"
          aria-label="ফিরে যান"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-base sm:text-2xl font-bold tracking-tight text-foreground">
            পেমেন্ট করুন
          </h1>
          <p className="hidden sm:block mt-0.5 text-sm text-muted-foreground">
            পেমেন্ট মেথড নির্বাচন করুন এবং তথ্য প্রদান করুন
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MOBILE: Name-only bank grid → big number → inputs
          ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:hidden flex-1 min-h-0">
        {/* ── Step 1: Bank Selection (name + icon only) ── */}
        {methods.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {methods.map((method) => {
              const isSelected = method.id === selectedId;
              const methodColor = method.color || '#84CC16';
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedId(method.id)}
                  className="relative flex items-center gap-2.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-lg px-3.5 py-3 border-2 transition-all duration-200"
                  style={{
                    borderColor: isSelected ? methodColor : 'transparent',
                  }}
                >
                  {method.image ? (
                    <div className="shrink-0 h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center">
                      <img src={method.image} alt={method.name} className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: isSelected
                          ? `color-mix(in srgb, ${methodColor} 18%, transparent)`
                          : 'hsl(var(--muted))',
                        color: isSelected ? methodColor : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {(() => { const I = getMethodIcon(method.name); return <I className="h-5 w-5" />; })()}
                    </div>
                  )}
                  <p className="text-sm font-bold text-foreground truncate leading-tight">
                    {method.name}
                  </p>
                  {isSelected && (
                    <div
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full flex items-center justify-center shadow-md"
                      style={{ backgroundColor: methodColor }}
                    >
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {methods.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-4 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">কোনো সক্রিয় পেমেন্ট মেথড নেই</p>
          </div>
        )}

        {/* ── Step 2+3: Number + Inputs + Confirm — all in one card ── */}
        <AnimatePresence>
          {selectedMethod && (
            <motion.div
              key={selectedMethod.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-4 border-l-4 flex flex-col"
              style={{ borderLeftColor: activeColor }}
            >
              {/* Amount row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">
                  মোট পরিমাণ
                  {feePercentage > 0 && <span className="ml-1 opacity-70">(+{feePercentage}% ফি)</span>}
                </span>
                <span
                  className="text-2xl font-extrabold"
                  style={{ color: activeColor }}
                >
                  ৳{totalAmount.toLocaleString('bn-BD')}
                </span>
              </div>

              {/* BIG account number with copy */}
              <div className="rounded-xl bg-muted/50 px-4 py-3.5 mb-3">
                <p className="text-[11px] text-muted-foreground mb-1">
                  {selectedMethod.name} {selectedMethod.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'} এ সেন্ড মানি করুন
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xl font-extrabold font-mono tracking-widest text-foreground">
                    {selectedMethod.accountNumber}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedMethod.accountNumber);
                      setCopied(selectedMethod.id);
                      toast.success('নম্বর কপি হয়েছে!');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-accent hover:scale-110 active:scale-95 shadow-sm"
                    aria-label="নম্বর কপি করুন"
                    style={{ color: activeColor }}
                  >
                    {copied === selectedMethod.id ? (
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Transaction inputs */}
              <div className="flex flex-col gap-2.5 mb-3">
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="tel"
                    placeholder="প্রেরকের নম্বর"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    className="pl-11 h-12 rounded-xl border-border/60 text-sm focus-visible:ring-1"
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="ট্রানজেকশন আইডি (TxnID)"
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                    className="pl-11 h-12 rounded-xl border-border/60 text-sm focus-visible:ring-1"
                  />
                </div>
              </div>

              {/* Confirm button — inside the card */}
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm || submitting}
                className="w-full h-14 rounded-xl text-base font-bold gap-2.5 shadow-lg transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: canConfirm ? activeColor : 'hsl(var(--muted))',
                  color: canConfirm ? contrastColor : 'hsl(var(--muted-foreground))',
                }}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                {submitting ? 'জমা হচ্ছে...' : 'কনফার্ম পেমেন্ট'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════════════
          DESKTOP: Full layout with large cards (scrollable)
          ═══════════════════════════════════════════════════════ */}
      <div className="hidden sm:flex flex-col gap-6 flex-1 overflow-y-auto">
        {/* ── Payment Method Selection Grid ── */}
        {methods.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              পেমেন্ট মেথড নির্বাচন করুন
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {methods.map((method) => {
                const isSelected = method.id === selectedId;
                const methodColor = method.color || '#84CC16';

                return (
                  <motion.button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedId(method.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-4 border-2 transition-colors duration-200 cursor-pointer"
                    style={{
                      borderColor: isSelected ? methodColor : 'transparent',
                    }}
                  >
                    {method.image ? (
                      <div className="shrink-0 h-11 w-11 rounded-xl overflow-hidden flex items-center justify-center">
                        <img src={method.image} alt={method.name} className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    ) : (
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: isSelected
                            ? `color-mix(in srgb, ${methodColor} 18%, transparent)`
                            : 'hsl(var(--muted))',
                          color: isSelected ? methodColor : 'hsl(var(--muted-foreground))',
                        }}
                      >
                        {(() => { const I = getMethodIcon(method.name); return <I className="h-5 w-5" />; })()}
                      </div>
                    )}
                    <p className="text-base font-bold text-foreground truncate">
                      {method.name}
                    </p>
                    <Badge
                      className={`ml-auto shrink-0 border-0 text-xs font-medium ${
                        method.accountType === 'merchant'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400'
                      }`}
                    >
                      {method.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'}
                    </Badge>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {methods.length === 0 && !loading && (
          <div className="bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-6 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              কোনো সক্রিয় পেমেন্ট মেথড পাওয়া যায়নি
            </p>
          </div>
        )}

        {/* ── Payment Instructions Section ── */}
        <AnimatePresence>
          {selectedMethod && (
            <motion.div
              key={selectedMethod.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-5 border-l-4"
              style={{ borderLeftColor: activeColor }}
            >
              <h2 className="mb-4 text-base font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" style={{ color: activeColor }} />
                পেমেন্ট তথ্য
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ডিলের পরিমাণ</span>
                  <span className="text-base font-semibold text-foreground">
                    ৳{amount.toLocaleString('bn-BD')}
                  </span>
                </div>
                {feeCalc?.matchedRule && (
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                    <span className="text-xs text-muted-foreground">প্রযোজ্য ফি স্ল্যাব</span>
                    <span className="text-xs font-semibold text-primary">
                      ৳{feeCalc.matchedRule.minimum_amount.toLocaleString('bn-BD')} — ৳{feeCalc.matchedRule.maximum_amount === 0 ? '∞' : feeCalc.matchedRule.maximum_amount.toLocaleString('bn-BD')}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    প্ল্যাটফর্ম ফি
                    {feePercentage > 0 && (
                      <span className="text-xs text-muted-foreground/70 ml-1">
                        (~{feePercentage}%)
                      </span>
                    )}
                  </span>
                  <span className="text-base font-semibold text-foreground">
                    ৳{fee.toLocaleString('bn-BD')}
                  </span>
                </div>
                <div className="border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">মোট পরিমাণ</span>
                    <span
                      className="text-xl font-bold"
                      style={{ color: activeColor }}
                    >
                      ৳{totalAmount.toLocaleString('bn-BD')}
                    </span>
                  </div>
                </div>
                {/* BIG account number — prominent display */}
                <div className="rounded-xl bg-muted/50 px-5 py-5">
                  <p className="text-xs text-muted-foreground mb-2">{selectedMethod.name} {selectedMethod.accountType === 'merchant' ? 'মার্চেন্ট' : 'পার্সোনাল'} এ সেন্ড মানি করুন</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-2xl font-extrabold font-mono tracking-widest text-foreground">
                      {selectedMethod.accountNumber}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedMethod.accountNumber);
                        setCopied(selectedMethod.id);
                        toast.success('নম্বর কপি হয়েছে!');
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-accent hover:scale-110 active:scale-95 shadow-sm"
                      aria-label="নম্বর কপি করুন"
                      style={{ color: activeColor }}
                    >
                      {copied === selectedMethod.id ? (
                        <Check className="h-5 w-5" strokeWidth={2.5} />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input Section ── */}
        <div className="bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            আপনার পেমেন্ট তথ্য
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senderNumber" className="text-sm font-medium text-foreground">
                প্রেরকের নম্বর
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="senderNumber"
                  type="tel"
                  placeholder="আপনার bKash/Nagad/Rocket নম্বর"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-border/60 focus-visible:ring-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="txnId" className="text-sm font-medium text-foreground">
                ট্রানজেকশন আইডি (TxnID)
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="txnId"
                  type="text"
                  placeholder="ট্রানজেকশন আইডি লিখুন"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-border/60 focus-visible:ring-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Confirm Payment Button ── */}
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm || submitting}
          className="w-full h-12 rounded-xl text-base font-bold gap-2.5 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: canConfirm ? activeColor : 'hsl(var(--muted))',
            color: canConfirm ? contrastColor : 'hsl(var(--muted-foreground))',
          }}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ShieldCheck className="h-5 w-5" />
          )}
          {submitting ? 'জমা হচ্ছে...' : 'কনফার্ম পেমেন্ট'}
        </Button>
      </div>
    </div>
  );
}