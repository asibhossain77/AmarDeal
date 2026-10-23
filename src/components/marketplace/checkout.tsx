'use client';

/**
 * CheckoutView — Phase 4 direct-checkout page (view 'page-checkout').
 * Renders INSIDE MarketplaceApp's shell so the desktop sidebar, compact
 * header, cart badge and theme tokens stay consistent with the Marketplace.
 *
 * Two steps, one page:
 *   Step 1 — ORDER FORM
 *     · product + price summary (server-truth refetched from /api/products/[id])
 *     · quantity (physical: capped by live stock)
 *     · buyer contact — name + active phone (prefilled from the session user)
 *     · physical  → district (৬৪ জেলা) + area + full address + optional
 *                   postal code + optional delivery instructions
 *     · digital   → product-specific fulfilment info (game ID / account
 *                   details) — collected only when needed, stored privately
 *                   on the order (buyer/seller/admin visibility only)
 *     · workflow explainer: Direct Order ≠ Admin Deal
 *     · POST /api/orders — the SERVER computes the total from DB prices,
 *       re-checks eligibility + stock atomically, and deduplicates via an
 *       idempotency key. Client numbers are display-only.
 *   Step 2 — PAYMENT (order is pending_payment / unpaid)
 *     · gateway (PipraPay) when enabled — POST /api/marketplace/payment/
 *       create-charge → trusted redirect; the order is NEVER marked paid
 *       by the browser — only the gateway verify/webhook or an admin can
 *     · manual — existing PaymentMethod table + sender number + TXN id →
 *       paymentStatus=awaiting_verification until an admin verifies
 *     · pay later → My Orders (buyer's order detail has the same actions)
 *
 * Reuse policy: every submission hits the EXISTING endpoints (POST /api/orders,
 * POST /api/marketplace/orders/[id]/payment, POST /api/marketplace/payment/
 * create-charge). No new backend surface is introduced here beyond the
 * Phase 4 eligibility extension of POST /api/orders itself.
 */

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, ShoppingCart, Loader2, Minus, Plus, Boxes, Check, Wallet,
  ShieldCheck, Truck, FileDown, MapPin, User, Phone, StickyNote, Clock3,
  CreditCard, Zap, BadgeCheck, Info, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store';
import { useT, type TranslationKey } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { fbqTrack, genMetaEventId } from '@/lib/meta-client';
import { BD_DISTRICTS } from '@/lib/bd-districts';

interface CheckoutProductSeller {
  id: string; name: string; email?: string; sellerRole?: string | null;
}
interface CheckoutProductOption {
  id: string; name: string; price: number; isAvailable: boolean; sortOrder: number;
}
interface CheckoutProduct {
  id: string; title: string; price: number; category: string;
  image?: string | null; quantity?: number; status: string;
  seller: CheckoutProductSeller;
  productType?: string;
  itemType?: string;
  digitalKind?: string | null;
  options?: CheckoutProductOption[];
  isPlatformOwned?: boolean;
  isFree?: boolean; hasFile?: boolean;
}

/* Placed-order lite payload — the same shape POST /api/orders returns */
interface PlacedOrder {
  id: string; orderNumber: string; status: string; paymentStatus: string;
  quantity: number; unitPriceAtOrder: number; totalAmount: number; optionName?: string | null;
}
interface PaymentMethodLite {
  id: string; name: string; accountNumber: string; accountType: string;
  instructions?: string | null; color?: string | null;
}

const MAX_QTY = 99;

/* Digital classification → fulfilment-info label key (same mapping the
   product page uses for the kind badge) */
const DIGITAL_KIND_LABELS: Record<string, TranslationKey> = {
  file: 'seller.digitalKindFile',
  account: 'seller.digitalKindAccount',
  license: 'seller.digitalKindLicense',
  subscription: 'seller.digitalKindSubscription',
  other: 'seller.digitalKindOther',
};

function formatPrice(price: number): string {
  return '৳' + price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function CheckoutView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const checkoutDraft = useAppStore((s) => s.checkoutDraft);
  const setView = useAppStore((s) => s.setView);
  const setProductDetailId = useAppStore((s) => s.setProductDetailId);

  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [loading, setLoading] = useState(true);

  /* Step 1 form state */
  const [qty, setQty] = useState(1);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [area, setArea] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [fulfilmentInfo, setFulfilmentInfo] = useState('');
  const [placing, setPlacing] = useState(false);
  /* Idempotency key — generated once per checkout attempt so retries
     (network error, double-click) return the SAME order, no duplicates. */
  const [orderReqId, setOrderReqId] = useState<string | null>(null);

  /* Step 2 payment state */
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [payMethods, setPayMethods] = useState<PaymentMethodLite[]>([]);
  const [payMethodId, setPayMethodId] = useState('');
  const [paySender, setPaySender] = useState('');
  const [payTxn, setPayTxn] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [gatewayStarting, setGatewayStarting] = useState(false);

  const isMulti = product?.productType === 'multi' && (product.options?.length ?? 0) > 0;
  const selectedOption = useMemo(
    () => (isMulti ? product?.options?.find((o) => o.id === selectedOptionId) ?? null : null),
    [isMulti, product?.options, selectedOptionId]
  );
  const unitPrice = isMulti ? (selectedOption?.price ?? null) : (product?.price ?? 0);

  const isPhysical = product?.itemType === 'physical';
  const isPlatformOwned = !!product?.isPlatformOwned;
  const isBusinessSeller = product?.seller?.sellerRole === 'business';
  const canDirectOrder = isPlatformOwned || isBusinessSeller;
  const stock = isPhysical ? (product?.quantity ?? 0) : null;
  const outOfStock = isPhysical && stock !== null && stock <= 0;
  const maxQty = isPhysical && stock !== null && stock > 0 ? Math.min(MAX_QTY, stock) : MAX_QTY;
  /* Fulfilment info is REQUIRED for digital kinds where the seller cannot
     deliver without it (account / license / subscription). Files and
     everything else keep it optional. */
  const digitalKindKey = product?.digitalKind ? DIGITAL_KIND_LABELS[product.digitalKind] : null;
  const fulfilmentRequired = !isPhysical && ['account', 'license', 'subscription'].includes(product?.digitalKind ?? '');

  /* Prefill contact from the session user (server re-sanitizes everything) */
  useEffect(() => {
    if (user) {
      setBuyerName((cur) => cur || user.name || '');
      setBuyerPhone((cur) => cur || user.phone || '');
    }
  }, [user?.id]);

  /* Load the product — server truth, same endpoint the product page uses */
  useEffect(() => {
    const productId = checkoutDraft?.productId;
    if (!productId) { setLoading(false); return; }
    setLoading(true);
    setPlacedOrder(null);
    setOrderReqId(null);
    setQty(1);
    fetch(`/api/products/${productId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.product) {
          const p: CheckoutProduct = d.product;
          setProduct(p);
          // Multi-price: restore the option picked on the product page
          const opts = (p.options ?? []).filter((o) => o.isAvailable);
          if (p.productType === 'multi' && opts.length > 0) {
            const pre = opts.find((o) => o.id === checkoutDraft?.optionId) ?? (opts.length === 1 ? opts[0] : null);
            if (pre) setSelectedOptionId(pre.id);
          }
          if (checkoutDraft?.quantity && checkoutDraft.quantity > 1) {
            setQty(checkoutDraft.quantity);
          }
        } else {
          setProduct(null);
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [checkoutDraft?.productId]);

  /* Payment methods + gateway availability — loaded when step 2 opens */
  useEffect(() => {
    if (!placedOrder) return;
    fetch('/api/auth/piprapay-status')
      .then((r) => r.json())
      .then((d) => setGatewayEnabled(!!d?.enabled))
      .catch(() => setGatewayEnabled(false));
    fetch('/api/payment-methods')
      .then((r) => r.json())
      .then((json) => {
        const list: PaymentMethodLite[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.methods)
            ? json.methods
            : [];
        const active = list.filter((m) => m && m.id && m.name);
        setPayMethods(active);
        if (active.length > 0) setPayMethodId((cur) => cur || active[0].id);
      })
      .catch(() => {});
  }, [placedOrder?.id]);

  const totalPreview = (unitPrice ?? product?.price ?? 0) * qty;

  const backToProduct = () => {
    if (product?.id) {
      setProductDetailId(product.id);
      setView('page-product');
    } else {
      setView('page-marketplace');
    }
  };

  /* ── Validation — client-side convenience; the server re-validates
        every field and recomputes the total from DB prices. ── */
  const validate = (): string | null => {
    if (!product) return t('checkout.loadFailed');
    if (isMulti && !selectedOption) return t('marketplace.selectPackageHint');
    if (isPhysical && stock !== null && qty > stock) return t('marketplace.insufficientStock');
    if (!buyerName.trim()) return t('checkout.nameRequired');
    if (!/^01[3-9]\d{8}$/.test(buyerPhone.trim())) return t('checkout.phoneInvalid');
    if (isPhysical) {
      if (!district.trim()) return t('checkout.districtRequired');
      if (!area.trim()) return t('checkout.areaRequired');
      if (!addressLine.trim()) return t('checkout.addressRequired');
    }
    if (fulfilmentRequired && !fulfilmentInfo.trim()) return t('checkout.fulfilmentRequired');
    return null;
  };

  /* ── Step 1 → Step 2: place the order (NEVER a Deal / escrow) ── */
  const placeOrder = async () => {
    if (!product) return;
    const err = validate();
    if (err) { toast.error(err); return; }

    fbqTrack('InitiateCheckout', {
      content_type: 'product',
      content_ids: [product.id],
      value: totalPreview,
      currency: 'BDT',
      num_items: qty,
    }, genMetaEventId('ic'));

    const reqId = orderReqId ?? `web_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    setOrderReqId(reqId);
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          optionId: selectedOption?.id,
          quantity: qty,
          clientRequestId: reqId,
          // Buyer contact (common) + physical delivery / digital fulfilment
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          ...(isPhysical
            ? {
                // District + area + full address → the order's delivery row
                // (city = district; area leads the address line so the
                // seller reads এলাকা first)
                addressLine: [area.trim(), addressLine.trim()].filter(Boolean).join(', '),
                city: district.trim(),
                postalCode: postalCode.trim() || undefined,
                deliveryNote: deliveryNote.trim() || undefined,
              }
            : {}),
          ...(isPhysical
            ? {}
            : { customerNote: fulfilmentInfo.trim() || undefined }),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPlacedOrder(data.order as PlacedOrder);
        setPaySender(''); setPayTxn(''); setPayMethodId('');
        toast.success(t('marketplace.orderPlaced'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (res.status === 401) {
        toast.error(t('marketplace.loginRequired'));
        setView('auth');
      } else {
        toast.error(data.error || t('marketplace.orderFailed'));
        // allow a fresh attempt — burn the used request id on hard failures
        if (data.code !== 'REQUEST_ID_TAKEN') setOrderReqId(null);
      }
    } catch {
      toast.error(t('marketplace.orderFailed'));
      setOrderReqId(null);
    } finally {
      setPlacing(false);
    }
  };

  /* ── Manual payment submission — the EXISTING endpoint: owner-only,
        unpaid-only, duplicate-txn guard; goes to awaiting_verification
        until an admin verifies. The order is NEVER marked paid here. ── */
  const submitManualPayment = async () => {
    if (!placedOrder) return;
    if (!paySender.trim() || !payTxn.trim()) {
      toast.error(t('orders.paymentFieldsRequired'));
      return;
    }
    setPaySubmitting(true);
    try {
      const res = await fetch(`/api/marketplace/orders/${placedOrder.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: payMethodId || undefined,
          senderNumber: paySender.trim(),
          transactionId: payTxn.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPlacedOrder({ ...placedOrder, status: 'pending_payment', paymentStatus: 'awaiting_verification' });
        toast.success(t('orders.paymentSubmitted'));
      } else {
        toast.error(data.error || t('orders.paymentFailed'));
      }
    } catch {
      toast.error(t('orders.paymentFailed'));
    } finally {
      setPaySubmitting(false);
    }
  };

  /* ── Gateway payment — the EXISTING create-charge endpoint. The browser
        only triggers a redirect; paid status comes exclusively from the
        gateway's server-to-server verify/webhook (or an admin). ── */
  const startGatewayPayment = async () => {
    if (!placedOrder) return;
    setGatewayStarting(true);
    try {
      const res = await fetch('/api/marketplace/payment/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: placedOrder.id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast.error(data.error || t('orders.paymentFailed'));
        setGatewayStarting(false);
      }
    } catch {
      toast.error(t('orders.paymentFailed'));
      setGatewayStarting(false);
    }
  };

  const goMyOrders = () => {
    const store = useAppStore.getState();
    store.setDashboardPanel('my-orders');
    store.setView('dashboard');
  };

  const imgSrc = product?.image ? cdnUrl(product.image) : null;

  /* ── Guard states ── */
  if (!loading && (!checkoutDraft || !product)) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/50 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShoppingCart className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t('checkout.emptyTitle')}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('checkout.emptyDesc')}</p>
          </div>
          <Button onClick={() => setView('page-marketplace')} className="gap-2 rounded-xl text-[13px] font-semibold">
            <Package className="h-4 w-4" />{t('checkout.goMarketplace')}
          </Button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-2xl bg-muted/60" />
          <div className="h-40 rounded-2xl bg-muted/60" />
          <div className="h-32 rounded-2xl bg-muted/60" />
        </div>
      </main>
    );
  }

  if (!canDirectOrder || product.status !== 'active' || product.isFree) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/50 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
            <Info className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="max-w-sm text-sm font-medium text-muted-foreground">{t('checkout.notEligible')}</p>
          <Button onClick={backToProduct} variant="outline" className="gap-2 rounded-xl text-[13px] font-semibold">
            <ArrowLeft className="h-4 w-4" />{t('checkout.backToProduct')}
          </Button>
        </div>
      </main>
    );
  }

  /* ══════════════ STEP 2 — PAYMENT ══════════════ */
  if (placedOrder) {
    const isAwaiting = placedOrder.paymentStatus === 'awaiting_verification';
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Success header */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{t('checkout.placedTitle')}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t('checkout.placedDesc')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 font-mono text-[11px] font-bold text-foreground" dir="ltr">
                  {placedOrder.orderNumber}
                </span>
                <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                  {t('orderStatus.pending_payment')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payable amount */}
        <div className="mt-4 rounded-2xl border border-border/40 bg-card p-4 dark:border-border/25">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">{product.title}</p>
              {placedOrder.optionName && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{placedOrder.optionName}</p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatPrice(placedOrder.unitPriceAtOrder)} × {placedOrder.quantity.toLocaleString('en')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('checkout.payable')}</p>
              <p className="text-xl font-extrabold tabular-nums text-primary">{formatPrice(placedOrder.totalAmount)}</p>
            </div>
          </div>
          {isAwaiting ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <Clock3 className="h-4 w-4 shrink-0" />
              {t('orders.paymentVerifying')}
            </div>
          ) : (
            <p className="mt-3 text-[12px] font-medium text-muted-foreground">{t('checkout.payNowHint')}</p>
          )}
        </div>

        {/* Payment options — only while unpaid */}
        {placedOrder.paymentStatus === 'unpaid' && (
          <div className="mt-4 space-y-3">
            {/* Gateway (PipraPay) */}
            {gatewayEnabled && (
              <button
                type="button"
                onClick={startGatewayPayment}
                disabled={gatewayStarting}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 text-left transition-all hover:border-primary/40 dark:border-border/25 disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  {gatewayStarting ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Zap className="h-5 w-5 text-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                    {t('orderDetail.gatewayPay')}
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{t('orderDetail.gatewayDesc')}</span>
                </span>
              </button>
            )}

            {/* Manual — bKash / Nagad etc. to the platform accounts */}
            <div className="rounded-2xl border border-border/40 bg-card p-4 dark:border-border/25">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <p className="text-[13px] font-bold text-foreground">{t('checkout.manualPayTitle')}</p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('checkout.manualPayDesc')}</p>
              <div className="mt-3 space-y-2.5">
                {payMethods.length > 0 && (
                  <div className="space-y-1">
                    <Label htmlFor="checkout-pay-method" className="text-[12px] font-medium text-muted-foreground">{t('orders.paymentMethod')}</Label>
                    <select
                      id="checkout-pay-method"
                      value={payMethodId}
                      onChange={(e) => setPayMethodId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {payMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.accountNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="checkout-pay-sender" className="text-[12px] font-medium text-muted-foreground">{t('orders.senderNumber')}</Label>
                    <Input id="checkout-pay-sender" value={paySender} onChange={(e) => setPaySender(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="checkout-pay-txn" className="text-[12px] font-medium text-muted-foreground">{t('orders.transactionId')}</Label>
                    <Input id="checkout-pay-txn" value={payTxn} onChange={(e) => setPayTxn(e.target.value)} placeholder={t('orders.txnPlaceholder')} className="h-10" />
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{t('orders.paymentVerifyNote')}</p>
                <Button onClick={submitManualPayment} disabled={paySubmitting} className="h-11 w-full gap-2 rounded-xl text-[13px] font-semibold">
                  {paySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {t('orders.submitPayment')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Button onClick={goMyOrders} variant="outline" className="mt-4 h-11 w-full gap-2 rounded-xl text-[13px] font-semibold">
          <Package className="h-4 w-4" />{t('checkout.goMyOrders')}
        </Button>
      </main>
    );
  }

  /* ══════════════ STEP 1 — ORDER FORM ══════════════ */
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 sm:px-6 lg:px-8">
      {/* Title row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={backToProduct}
          aria-label={t('checkout.backToProduct')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-[17px] font-extrabold text-foreground sm:text-xl">{t('checkout.title')}</h1>
          <p className="text-[11px] text-muted-foreground sm:text-[12px]">{t('checkout.subtitle')}</p>
        </div>
      </div>

      {/* Product + price summary */}
      <section className="mt-4 rounded-2xl border border-border/40 bg-card p-4 dark:border-border/25" aria-label={t('checkout.productSummary')}>
        <div className="flex gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/60">
            {imgSrc ? (
              <img src={imgSrc} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[14px] font-bold leading-snug text-foreground">{product.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {isPhysical ? <><Truck className="h-3 w-3" />{t('seller.itemPhysical')}</> : <><FileDown className="h-3 w-3" />{t('seller.itemNonPhysical')}</>}
              </span>
              {digitalKindKey && !isPhysical && (
                <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {t(digitalKindKey)}
                </span>
              )}
              {outOfStock ? (
                <span className="inline-flex items-center rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-400">
                  {t('marketplace.outOfStock')}
                </span>
              ) : isPhysical && stock !== null ? (
                <span className="inline-flex items-center rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  {t('checkout.stockLeft', { count: stock })}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-[15px] font-extrabold tabular-nums text-primary">
              {formatPrice(unitPrice ?? product.price)}
              {isMulti && !selectedOption && <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">{t('checkout.selectPackageFirst')}</span>}
            </p>
          </div>
        </div>

        {/* Option selector — same card pattern as the product page */}
        {isMulti && (
          <div className="mt-4">
            <p className="text-[12px] font-bold text-foreground">{t('marketplace.selectPackage')}</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(product.options ?? []).map((opt) => {
                const selected = opt.id === selectedOptionId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!opt.isAvailable}
                    onClick={() => setSelectedOptionId(opt.id)}
                    aria-pressed={selected}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/40 bg-background hover:border-primary/40 dark:border-border/25'
                    } ${opt.isAvailable ? '' : 'opacity-45'}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                        {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className={`truncate text-[12px] font-semibold ${selected ? 'text-primary' : 'text-foreground'}`}>{opt.name}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-foreground">{formatPrice(opt.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-4 dark:border-border/20">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Boxes className="h-4 w-4" />{t('marketplace.quantity')}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-xl border border-border/50 dark:border-border/30">
              <button
                type="button"
                aria-label="decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="flex h-10 w-10 items-center justify-center text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-[15px] font-bold tabular-nums text-foreground">{qty}</span>
              <button
                type="button"
                aria-label="increase quantity"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={qty >= maxQty || outOfStock}
                className="flex h-10 w-10 items-center justify-center text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/5 px-3.5 py-3">
          <span className="text-[12px] font-semibold text-muted-foreground">{t('checkout.totalPreview')}</span>
          <span className="text-lg font-extrabold tabular-nums text-primary">{formatPrice(totalPreview)}</span>
        </div>
        <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          {t('checkout.serverCalcNote')}
        </p>
      </section>

      {/* Buyer contact */}
      <section className="mt-4 rounded-2xl border border-border/40 bg-card p-4 dark:border-border/25" aria-label={t('checkout.contactSection')}>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-[13px] font-bold text-foreground">{t('checkout.contactSection')}</h2>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="checkout-name" className="text-[12px] font-medium text-muted-foreground">{t('checkout.buyerName')} *</Label>
            <Input id="checkout-name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} maxLength={120} className="h-10" autoComplete="name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="checkout-phone" className="text-[12px] font-medium text-muted-foreground">{t('checkout.buyerPhone')} *</Label>
            <Input id="checkout-phone" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" maxLength={30} className="h-10" autoComplete="tel" />
          </div>
        </div>
      </section>

      {/* Physical → delivery address */}
      {isPhysical && (
        <section className="mt-4 rounded-2xl border border-border/40 bg-card p-4 dark:border-border/25" aria-label={t('checkout.deliverySection')}>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-[13px] font-bold text-foreground">{t('checkout.deliverySection')}</h2>
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="checkout-district" className="text-[12px] font-medium text-muted-foreground">{t('checkout.district')} *</Label>
                <select
                  id="checkout-district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{t('checkout.districtPlaceholder')}</option>
                  {BD_DISTRICTS.map((d) => (
                    <option key={d.en} value={d.bn}>{d.bn}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="checkout-area" className="text-[12px] font-medium text-muted-foreground">{t('checkout.area')} *</Label>
                <Input id="checkout-area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} placeholder={t('checkout.areaPlaceholder')} className="h-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="checkout-address" className="text-[12px] font-medium text-muted-foreground">{t('checkout.fullAddress')} *</Label>
              <textarea
                id="checkout-address"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder={t('checkout.fullAddressPlaceholder')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="checkout-postal" className="text-[12px] font-medium text-muted-foreground">{t('checkout.postalCode')}</Label>
                <Input id="checkout-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20} inputMode="numeric" className="h-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="checkout-note" className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
                <StickyNote className="h-3 w-3" />{t('checkout.deliveryNote')}
              </Label>
              <textarea
                id="checkout-note"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={t('checkout.deliveryNotePlaceholder')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </section>
      )}

      {/* Digital → fulfilment info */}
      {!isPhysical && (
        <section className="mt-4 rounded-2xl border border-border/40 bg-card p-4 dark:border-border/25" aria-label={t('checkout.fulfilmentSection')}>
          <div className="flex items-center gap-2">
            <FileDown className="h-4 w-4 text-primary" />
            <h2 className="text-[13px] font-bold text-foreground">{t('checkout.fulfilmentSection')}</h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t(fulfilmentRequired ? 'checkout.fulfilmentDescRequired' : 'checkout.fulfilmentDesc')}
          </p>
          <div className="mt-3 space-y-1">
            <Label htmlFor="checkout-fulfil" className="text-[12px] font-medium text-muted-foreground">
              {t('checkout.fulfilmentLabel', { kind: digitalKindKey ? t(digitalKindKey) : '' })}{fulfilmentRequired ? ' *' : ''}
            </Label>
            <textarea
              id="checkout-fulfil"
              value={fulfilmentInfo}
              onChange={(e) => setFulfilmentInfo(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={t('checkout.fulfilmentPlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="flex items-start gap-1 text-[10px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              {t('checkout.fulfilmentPrivacy')}
            </p>
          </div>
        </section>
      )}

      {/* Workflow explainer — Direct Order vs Admin Deal */}
      <section className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 dark:border-primary/20">
        <h2 className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
          <Info className="h-3.5 w-3.5 text-primary" />{t('checkout.workflowTitle')}
        </h2>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-background p-3 dark:border-border/25">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-primary">
              <ShoppingCart className="h-3.5 w-3.5" />{t('checkout.workflowDirectTitle')}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('checkout.workflowDirectDesc')}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background p-3 dark:border-border/25">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />{t('checkout.workflowDealTitle')}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('checkout.workflowDealDesc')}</p>
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="sticky bottom-16 mt-4 pb-2 md:bottom-4">
        <Button
          onClick={placeOrder}
          disabled={placing || outOfStock || (isMulti && !selectedOption)}
          className="h-13 w-full gap-2 rounded-2xl py-4 text-[15px] font-bold shadow-lg shadow-primary/25"
        >
          {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
          {placing
            ? t('marketplace.placingOrder')
            : outOfStock
              ? t('marketplace.outOfStock')
              : `${t('checkout.placeOrder')} — ${formatPrice(totalPreview)}`}
        </Button>
      </div>
    </main>
  );
}
