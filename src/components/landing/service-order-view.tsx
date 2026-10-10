'use client';

/**
 * SMM Service order page — service info, order form (target link +
 * quantity), server-verified review step, then payment (PipraPay
 * gateway or manual bKash/Nagad submission). After placing an order
 * the customer is taken to their order page / My Orders.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, ShieldCheck, Zap, Loader2, Package, Clock, Info,
  Minus, Plus, Link2, BadgeCheck, CreditCard, Wallet, X, CheckCircle2, LayoutList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { calculateOrderTotal, SERVICE_CATEGORY_LABELS } from '@/lib/marketplace-pricing';
import { PageWrapper } from './page-wrapper';
import { Footer } from './footer';

interface StoreService {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePerThousand: number;
  minQuantity: number;
  maxQuantity: number;
  linkTypes: string[];
  deliveryEstimate: string | null;
  instructions: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ManualMethod {
  id: string;
  name: string;
  accountNumber: string;
  instructions: string | null;
  qrImage: string | null;
  color: string;
  status?: string;
}

function formatPrice(price: number): string {
  return '৳' + price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `mp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

type Step = 'form' | 'review' | 'payment';

export function ServiceOrderView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const serviceDetailId = useAppStore((s) => s.serviceDetailId);
  const setView = useAppStore((s) => s.setView);

  const [service, setService] = useState<StoreService | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('form');
  const [link, setLink] = useState('');
  const [linkType, setLinkType] = useState('');
  const [qty, setQty] = useState(0);
  const [placing, setPlacing] = useState(false);

  // Payment state
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [payingGateway, setPayingGateway] = useState(false);
  const [methods, setMethods] = useState<ManualMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [manualMethodId, setManualMethodId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Fetch service
  useEffect(() => {
    if (!serviceDetailId) return;
    setLoading(true);
    setStep('form');
    setService(null);
    setLink('');
    setQty(0);
    fetch(`/api/marketplace/services/${serviceDetailId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.service) {
          setService(d.service);
          setQty(d.service.minQuantity);
          if (d.service.linkTypes?.length) setLinkType(d.service.linkTypes[0]);
        } else {
          setService(null);
        }
      })
      .catch(() => setService(null))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [serviceDetailId]);

  // Gateway availability (public status probe)
  useEffect(() => {
    fetch('/api/auth/piprapay-status')
      .then((r) => r.json())
      .then((d) => setGatewayEnabled(!!d?.enabled))
      .catch(() => setGatewayEnabled(false));
  }, []);

  const bn = locale === 'bn';
  const isIntegerQty = Number.isInteger(qty) && qty > 0;
  const withinBounds = !!service && isIntegerQty && qty >= service.minQuantity && qty <= service.maxQuantity;
  const linkValid = /^https?:\/\/\S+$/.test(link.trim());
  const linkTypeValid = !service?.linkTypes?.length || (linkType && service.linkTypes.includes(linkType));

  const previewTotal = useMemo(() => {
    if (!service || !isIntegerQty) return 0;
    return calculateOrderTotal(service.pricePerThousand, Math.min(Math.max(qty, 1), service.maxQuantity));
  }, [service, qty, isIntegerQty]);

  const catName = service ? SERVICE_CATEGORY_LABELS[service.category]?.[bn ? 'bn' : 'en'] || service.category : '';

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error(t('marketplace.loginRequired'));
      setView('auth');
      return;
    }
    if (!service || !withinBounds || !linkValid || !linkTypeValid) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          link: link.trim(),
          linkType: service.linkTypes?.length ? linkType : undefined,
          quantity: qty,
          idempotencyKey: generateIdempotencyKey(),
        }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setActiveOrderId(data.order.id);
        setStep('payment');
        toast.success(bn ? 'অর্ডার তৈরি হয়েছে — এখন পেমেন্ট করুন' : 'Order created — proceed to payment');
        // Load manual payment methods for the payment step
        setMethodsLoading(true);
        fetch('/api/payment-methods')
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d.methods)) setMethods(d.methods.filter((m: ManualMethod) => !m.status || m.status === 'active'));
            else if (Array.isArray(d)) setMethods(d);
          })
          .catch(() => {})
          .finally(() => setMethodsLoading(false));
      } else {
        toast.error(data.error || (bn ? 'অর্ডার করা যায়নি' : 'Could not place order'));
      }
    } catch {
      toast.error(bn ? 'অর্ডার করা যায়নি' : 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  const handleGatewayPay = async () => {
    if (!activeOrderId) return;
    setPayingGateway(true);
    try {
      const res = await fetch('/api/marketplace/payment/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: activeOrderId }),
      });
      const data = await res.json();
      if (data.success && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast.error(data.error || (bn ? 'পেমেন্ট শুরু করা যায়নি' : 'Could not start payment'));
      }
    } catch {
      toast.error(bn ? 'পেমেন্ট শুরু করা যায়নি' : 'Could not start payment');
    } finally {
      setPayingGateway(false);
    }
  };

  const handleManualPay = async () => {
    if (!activeOrderId || !manualMethodId || !senderNumber.trim() || !transactionId.trim()) {
      toast.error(bn ? 'সব তথ্য পূরণ করুন' : 'Fill in all fields');
      return;
    }
    setSubmittingManual(true);
    try {
      const res = await fetch(`/api/marketplace/orders/${activeOrderId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: manualMethodId,
          senderNumber: senderNumber.trim(),
          transactionId: transactionId.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(bn ? 'পেমেন্ট তথ্য জমা হয়েছে — যাচাইয়ের অপেক্ষায়' : 'Payment submitted — awaiting verification');
        const store = useAppStore.getState();
        store.setOrderDetailId(activeOrderId);
        store.setDashboardPanel('order-detail');
        store.setView('dashboard');
      } else {
        toast.error(data.error || (bn ? 'জমা দেওয়া যায়নি' : 'Could not submit'));
      }
    } catch {
      toast.error(bn ? 'জমা দেওয়া যায়নি' : 'Could not submit');
    } finally {
      setSubmittingManual(false);
    }
  };

  const goMyOrders = () => {
    const store = useAppStore.getState();
    store.setDashboardPanel('my-orders');
    store.setView('dashboard');
  };

  // ── Loading / not-found shells ──
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-2">
          <div className="aspect-[16/10] rounded-2xl bg-muted animate-pulse" />
          <div className="space-y-4">
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
            <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-7 w-28 rounded bg-muted animate-pulse" />
            <div className="h-20 w-full rounded bg-muted animate-pulse" />
            <div className="h-14 w-full rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Zap className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-muted-foreground">{bn ? 'সার্ভিসটি পাওয়া যায়নি বা আর সক্রিয় নেই' : 'Service not found or no longer available'}</p>
          <Button variant="outline" onClick={() => setView('page-marketplace')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" />{t('sellerProfile.backToMarketplace')}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <a
            href="/marketplace"
            onClick={(e) => { e.preventDefault(); setView('page-marketplace'); }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('sellerProfile.backToMarketplace')}
          </a>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pb-16 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid gap-6 lg:grid-cols-2 lg:gap-10"
        >
          {/* Service visual */}
          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent p-8 shadow-sm dark:border-border/25">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 shadow-lg shadow-primary/10">
              <Zap className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 text-[11px] font-semibold">{catName}</Badge>
              <div className="flex items-center gap-1 text-primary"><ShieldCheck className="h-4 w-4" /><span className="text-[11px] font-medium">{bn ? 'প্ল্যাটফর্ম-মালিকানাধীন সার্ভিস' : 'Platform-operated service'}</span></div>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{service.name}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{service.description}</p>
            {service.deliveryEstimate && (
              <div className="mt-4 flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>{bn ? 'ডেলিভারি:' : 'Delivery:'}</span>
                <span className="text-foreground" dir="ltr">{service.deliveryEstimate}</span>
              </div>
            )}
          </div>

          {/* Order panel */}
          <div className="flex flex-col">
            {step !== 'payment' ? (
              <>
                {/* Price */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-3xl font-extrabold text-primary">{formatPrice(service.pricePerThousand)}</p>
                  <p className="text-[13px] font-medium text-muted-foreground">/ 1,000 {bn ? 'ইউনিট' : 'units'}</p>
                </div>

                {/* Target link */}
                <div className="mt-5">
                  <label htmlFor="mp-link" className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    {bn ? 'টার্গেট লিংক' : 'Target link'}
                  </label>
                  <Input
                    id="mp-link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                    className="h-11 rounded-xl text-[13px]"
                    inputMode="url"
                    dir="ltr"
                  />
                  {link && !linkValid && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-destructive">
                      <X className="h-3 w-3" />{bn ? 'সম্পূর্ণ URL দিন (https://...)' : 'Enter a full URL (https://...)'}
                    </p>
                  )}
                </div>

                {/* Link type */}
                {service.linkTypes?.length > 0 && (
                  <div className="mt-4">
                    <label htmlFor="mp-linktype" className="mb-1.5 block text-[13px] font-medium text-foreground">
                      {bn ? 'লিংক টাইপ' : 'Link type'}
                    </label>
                    <select
                      id="mp-linktype"
                      value={linkType}
                      onChange={(e) => setLinkType(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {service.linkTypes.map((lt) => (
                        <option key={lt} value={lt}>{lt.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quantity */}
                <div className="mt-4">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    <LayoutList className="h-3.5 w-3.5 text-primary" />
                    {t('marketplace.quantity')}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center overflow-hidden rounded-xl border border-border">
                      <button
                        type="button"
                        aria-label="decrease quantity"
                        onClick={() => setQty((q) => Math.max(service.minQuantity, (q || service.minQuantity) - (q > service.minQuantity ? 100 : 0)))}
                        disabled={!isIntegerQty || qty <= service.minQuantity}
                        className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        value={qty || ''}
                        min={service.minQuantity}
                        max={service.maxQuantity}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : Math.floor(Number(e.target.value)))}
                        onBlur={() => { if (!qty) setQty(service.minQuantity); }}
                        aria-label={bn ? 'পরিমাণ' : 'Quantity'}
                        className="h-11 w-24 border-x border-border bg-background text-center text-[15px] font-bold text-foreground tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        aria-label="increase quantity"
                        onClick={() => setQty((q) => Math.min(service.maxQuantity, (q || service.minQuantity) + 100))}
                        disabled={!isIntegerQty || qty >= service.maxQuantity}
                        className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      {bn ? 'সর্বনিম্ন' : 'Min'} {service.minQuantity.toLocaleString('en-BD')} · {bn ? 'সর্বোচ্চ' : 'Max'} {service.maxQuantity.toLocaleString('en-BD')}
                    </p>
                  </div>
                </div>

                {/* Instructions */}
                {service.instructions && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-[12px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{service.instructions}</p>
                  </div>
                )}

                {/* Review box */}
                <div className="mt-5 rounded-xl border border-border/40 bg-muted/30 p-4 dark:border-border/25 dark:bg-zinc-800/30">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{bn ? 'মোট (সার্ভার-ক্যালকুলেটেড)' : 'Total (server-calculated)'}</span>
                    <span className="text-lg font-extrabold text-primary">{formatPrice(previewTotal)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">
                    {formatPrice(service.pricePerThousand)} / 1,000 × {qty.toLocaleString('en-BD')}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {bn ? 'পেমেন্ট যাচাইয়ের পরেই অর্ডার নিশ্চিত হয়' : 'Order confirms only after payment verification'}
                  </div>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={!withinBounds || !linkValid || !linkTypeValid || placing}
                  className="mt-5 h-14 w-full gap-2 rounded-xl text-[14px] font-semibold"
                >
                  {placing ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Zap className="h-4.5 w-4.5" />}
                  {bn ? 'অর্ডার করুন' : 'Place Order'}
                </Button>
                {!user && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    {bn ? 'অর্ডার করতে লগইন প্রয়োজন' : 'Login required to place an order'}
                  </p>
                )}
              </>
            ) : (
              /* ── Payment step ── */
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 text-[11px] font-semibold">{catName}</Badge>
                  <div className="flex items-center gap-1 text-primary"><BadgeCheck className="h-4 w-4" /><span className="text-[11px] font-medium">{bn ? 'অর্ডার তৈরি হয়েছে' : 'Order created'}</span></div>
                </div>
                <h2 className="mt-3 text-xl font-bold text-foreground sm:text-2xl">{service.name}</h2>
                <div className="mt-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{bn ? 'পরিমাণ' : 'Quantity'}</span>
                    <span className="font-semibold text-foreground tabular-nums">{qty.toLocaleString('en-BD')}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{bn ? 'টার্গেট লিংক' : 'Target link'}</span>
                    <span className="max-w-[60%] truncate font-medium text-foreground" dir="ltr">{link}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-primary/15 pt-2">
                    <span className="text-[13px] text-muted-foreground">{bn ? 'সর্বমোট' : 'Total'}</span>
                    <span className="text-xl font-extrabold text-primary">{formatPrice(previewTotal)}</span>
                  </div>
                </div>

                <h3 className="mt-5 text-[14px] font-bold text-foreground">{bn ? 'পেমেন্ট করুন' : 'Pay now'}</h3>

                {/* Gateway option */}
                {gatewayEnabled ? (
                  <button
                    onClick={handleGatewayPay}
                    disabled={payingGateway}
                    className="mt-3 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 disabled:opacity-60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                      {payingGateway ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <CreditCard className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground">{bn ? 'PipraPay অটোমেশন' : 'PipraPay Automation'}</p>
                      <p className="text-[11px] text-muted-foreground">{bn ? 'বিকাশ/নগদ/রকেট ইত্যাদি — অটো ভেরিফিকেশন' : 'bKash/Nagad/Rocket — auto verification'}</p>
                    </div>
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/30 p-3.5 text-[12px] text-muted-foreground dark:border-border/25">
                    <Wallet className="h-4 w-4 shrink-0" />
                    {bn ? 'গেটওয়ে পেমেন্ট সাময়িকভাবে বন্ধ — নিচের ম্যানুয়াল পদ্ধতি ব্যবহার করুন' : 'Gateway payment is currently off — use the manual method below'}
                  </div>
                )}

                {/* Manual option */}
                <div className="mt-4">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    {bn ? 'ম্যানুয়াল পেমেন্ট (প্ল্যাটফর্ম অ্যাকাউন্টে পাঠিয়ে ট্রানজেকশন জমা দিন)' : 'Manual payment (send to a platform account, submit the TXN)'}
                  </p>
                  {methodsLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{bn ? 'লোড হচ্ছে...' : 'Loading...'}</div>
                  ) : methods.length === 0 ? (
                    <p className="mt-2 text-[12px] text-muted-foreground">{bn ? 'কোনো পেমেন্ট মেথড পাওয়া যায়নি' : 'No payment methods available'}</p>
                  ) : (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {methods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setManualMethodId(m.id)}
                            className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${manualMethodId === m.id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border/40 hover:border-primary/25 dark:border-border/25'}`}
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ backgroundColor: m.color || '#84CC16' }}>
                              {m.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-bold text-foreground">{m.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground" dir="ltr">{m.accountNumber}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {manualMethodId && (() => {
                        const m = methods.find((x) => x.id === manualMethodId);
                        return m?.instructions ? (
                          <p className="rounded-lg bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{m.instructions}</p>
                        ) : null;
                      })()}
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <Input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} placeholder={bn ? 'সেন্ডার নম্বর' : 'Sender number'} className="h-11 rounded-xl text-[13px]" dir="ltr" />
                        <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder={bn ? 'ট্রানজেকশন আইডি' : 'Transaction ID'} className="h-11 rounded-xl text-[13px]" dir="ltr" />
                      </div>
                      <Button
                        onClick={handleManualPay}
                        disabled={submittingManual || !manualMethodId || !senderNumber.trim() || !transactionId.trim()}
                        variant="outline"
                        className="h-12 w-full gap-2 rounded-xl text-[13px] font-semibold"
                      >
                        {submittingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {bn ? 'পেমেন্ট তথ্য জমা দিন' : 'Submit payment info'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex gap-2">
                  <Button onClick={goMyOrders} variant="ghost" className="flex-1 rounded-xl text-[13px] font-semibold text-primary hover:bg-primary/10 hover:text-primary">
                    {bn ? 'আমার অর্ডারে দেখুন' : 'View in My Orders'}
                  </Button>
                  <Button onClick={() => { setStep('form'); }} variant="ghost" className="rounded-xl text-[13px] text-muted-foreground">
                    {bn ? 'ফিরে যান' : 'Back'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Trust strip */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3" aria-label={bn ? 'নিরাপত্তা তথ্য' : 'Trust information'}>
          {[
            { Icon: ShieldCheck, bn: 'পেমেন্ট ভেরিফিকেশনের পরেই কাজ শুরু', en: 'Work starts only after payment verification' },
            { Icon: Package, bn: 'প্রতিটি অর্ডারের স্ট্যাটাস ট্র্যাক করুন', en: 'Track every order status in real time' },
            { Icon: Zap, bn: 'প্ল্যাটফর্ম কর্তৃক পরিচালিত সার্ভিস', en: 'Services operated by the platform itself' },
          ].map(({ Icon, bn: b, en }, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/30 bg-card p-3.5 dark:border-border/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <p className="text-[12px] font-medium text-muted-foreground">{bn ? b : en}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
