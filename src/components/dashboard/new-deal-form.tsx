'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, PlusCircle, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

const emptySubscribe = () => () => {};

/* ─── Main New Deal Form ─── */
export function NewDealForm({ mode = 'buyer' }: { mode?: 'buyer' | 'seller' }) {
  const { setDashboardPanel, setSellerPanel, setActiveDeal, user } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [partyEmail, setPartyEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feePreview, setFeePreview] = useState<{ fee: number; total: number } | null>(null);

  // Fetch fee preview when amount changes
  useEffect(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeePreview(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/deals/calculate-fee?amount=${numAmount}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setFeePreview({ fee: data.fee, total: data.total }))
      .catch(() => setFeePreview(null));
    return () => controller.abort();
  }, [amount]);

  const handleSubmit = useCallback(async () => {
    setError('');
    if (!title.trim() || !role || !partyEmail.trim() || !amount.trim()) {
      setError(t('deal.fillRequired'));
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t('deal.validAmount'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/deals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          role,
          amount: numAmount,
          partyEmail: partyEmail.trim(),
          terms: terms.trim(),
          userId: user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('deal.createFailed'));
        return;
      }
      setActiveDeal({
        id: data.id,
        title: data.title || title.trim(),
        amount: numAmount,
        status: 'created',
        createdAt: data.createdAt || new Date().toISOString(),
        creatorId: user?.id,
        buyerName: data.buyerName,
        sellerName: data.sellerName,
      });
      toast.success(t('deal.createSuccess'));
      if (mode === 'seller') {
        setSellerPanel('deal-detail');
      } else {
        setDashboardPanel('deal-detail');
      }
    } catch {
      setError(t('deal.serverError'));
    } finally {
      setLoading(false);
    }
  }, [title, role, partyEmail, amount, terms, user, setDashboardPanel, setSellerPanel, setActiveDeal, t, mode]);

  if (!mounted) return null;

  const inputClass =
    'h-11 rounded-xl border-border bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder:text-zinc-500 text-center md:text-left';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-xl"
    >
      {/* ── Solid White Card ── */}
      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900 sm:p-8">
        {/* Header */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <PlusCircle className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t('deal.createTitle')}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t('deal.createDesc')}
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Field 1: Title */}
          <div className="space-y-2 text-center md:text-left">
            <Label htmlFor="deal-title" className="text-foreground text-sm">
              {t('deal.titleLabel')}
            </Label>
            <Input
              id="deal-title"
              type="text"
              placeholder={t('deal.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Field 2: Role (Radio Buttons) */}
          <div className="space-y-3 text-center md:text-left">
            <Label className="text-foreground text-sm">
              {t('deal.roleLabel')}
            </Label>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-start">
              {[
                { value: 'buyer', label: t('deal.buyer'), desc: t('deal.buyerDesc') },
                { value: 'seller', label: t('deal.seller'), desc: t('deal.sellerDesc') },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`flex w-full sm:flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    role === opt.value
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border bg-white hover:border-primary/40 dark:bg-zinc-800 dark:hover:border-primary/40'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      role === opt.value
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {role === opt.value && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        role === opt.value ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Field 3: Counterpart Email */}
          <div className="space-y-2 text-center md:text-left">
            <Label htmlFor="party-email" className="text-foreground text-sm">
              {t('deal.partyEmail')}
            </Label>
            <Input
              id="party-email"
              type="text"
              placeholder={t('deal.partyEmailPlaceholder')}
              value={partyEmail}
              onChange={(e) => setPartyEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Field 4: Amount */}
          <div className="space-y-2 text-center md:text-left">
            <Label htmlFor="deal-amount" className="text-foreground text-sm">
              {t('deal.amountLabel')}
            </Label>
            <Input
              id="deal-amount"
              type="number"
              placeholder={t('deal.amountPlaceholder')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
            {/* Fee Preview */}
            <AnimatePresence>
              {feePreview && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0.8 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.8 }}
                  style={{ transformOrigin: 'top' }}
                >
                  <div className="mt-2 rounded-xl bg-primary/5 border border-primary/15 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <Receipt className="h-3.5 w-3.5" />
                      {t('deal.feePreview')}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('deal.platformFee')}</span>
                      <span className="font-semibold text-foreground">৳{feePreview.fee.toLocaleString('en')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('deal.totalPay')}</span>
                      <span className="font-bold text-primary">৳{feePreview.total.toLocaleString('en')}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Field 5: Terms */}
          <div className="space-y-2 text-center md:text-left">
            <Label htmlFor="deal-terms" className="text-foreground text-sm">
              {t('deal.termsLabel')}
            </Label>
            <Textarea
              id="deal-terms"
              placeholder={t('deal.termsPlaceholder')}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={4}
              className="rounded-xl border-border bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder:text-zinc-500 text-center md:text-left resize-none"
            />
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-5 text-center text-sm text-destructive"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <div className="mt-7">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 dark:glow-lime gap-2.5"
          >
            {loading ? (
              <LoadingAnimation size="sm" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            {t('deal.createButton')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}