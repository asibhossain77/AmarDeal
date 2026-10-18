'use client';

/**
 * ProductDetailView — the Marketplace Product Details page (view
 * 'page-product'). Renders INSIDE MarketplaceApp's shell so the desktop
 * sidebar, compact header, cart badge and theme tokens stay consistent with
 * the rest of the Marketplace — no site navbar, no second sidebar.
 *
 * Layout:
 *   Mobile  — single column: image → badges/title/price → seller → options →
 *             quantity → three actions (Order Now · Admin Deal · Message) →
 *             description (Read More) → product details → suggested items.
 *   Desktop — two-column grid (image left, info + actions right), with the
 *             description and details sections in full content width below.
 *
 * Reuse policy: every behaviour is the existing product page logic, ported
 * 1:1 — /api/products/[id] fetch, multi-option selection, order-time
 * quantity, the DIRECT marketplace order flow (confirm → POST /api/orders →
 * inline manual payment submission — NEVER a Deal/escrow), free digital
 * claim/download, seller follow + profile, WhatsApp seller contact and
 * native/share popover. No new backend, no new pages, no fake data — only
 * fields the product model really has.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, MessageCircle, ShieldCheck, ShoppingCart, Loader2, User,
  Eye, Heart, Package, Minus, Plus, Boxes, Layers, Check, Share2, Link2,
  Facebook, FileDown, Download, ChevronDown, FileText, ClipboardList,
  CheckCircle2, Wallet, Clock3, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { waMeLink } from '@/lib/wa-me';
import { fbqTrack, genMetaEventId } from '@/lib/meta-client';
import { CATEGORIES, CATEGORY_BG } from '@/components/landing/marketplace-section';

interface OrderProductSeller {
  id: string; name: string; email?: string; imageLink?: string | null; whatsappNumber?: string | null;
}
interface OrderProductOption {
  id: string; name: string; price: number; isAvailable: boolean; sortOrder: number;
}
interface OrderProduct {
  id: string; title: string; description: string; price: number; category: string;
  image?: string | null; quantity?: number; status: string; createdAt: string; seller: OrderProductSeller;
  productType?: string;
  options?: OrderProductOption[];
  optionsCount?: number;
  minPrice?: number;
  maxPrice?: number;
  isFree?: boolean; hasFile?: boolean; fileName?: string | null; fileSize?: number | null;
}

/* Quantity is an order-time selection only — no stock concept (max 99 per order) */
const MAX_QTY = 99;

/* ── Direct marketplace order (POST /api/orders — NEVER a Deal) ── */
interface PlacedOrder {
  id: string; orderNumber: string; status: string; paymentStatus: string;
  quantity: number; unitPriceAtOrder: number; totalAmount: number; optionName?: string | null;
}
interface PaymentMethodLite {
  id: string; name: string; accountNumber: string; accountType: string;
  instructions?: string | null; color?: string | null;
}

/* Description longer than this gets the Read More / Show Less treatment */
const DESC_CLAMP_CHARS = 340;

// English digits everywhere — even in Bangla locale (user request)
function formatPrice(price: number): string {
  return '৳' + price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function ProductDetailView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const productDetailId = useAppStore((s) => s.productDetailId);
  const setView = useAppStore((s) => s.setView);
  const prevView = useAppStore((s) => s._prevView);
  const goBack = useAppStore((s) => s.goBack);

  /* Smart back: return to where the user came from (e.g. seller profile);
     fallback to the marketplace when there is no in-app history (direct URL). */
  const backTargetProfile = prevView === 'page-seller-profile';
  const handleBack = () => {
    if (backTargetProfile) goBack();
    else setView('page-marketplace');
  };

  const [product, setProduct] = useState<OrderProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggested, setSuggested] = useState<OrderProduct[]>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [qty, setQty] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);
  /* Direct marketplace order — created via POST /api/orders (NEVER a Deal) */
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [orderReqId, setOrderReqId] = useState<string | null>(null);
  /* Inline payment submission (mirrors the existing manual payment mechanism) */
  const [payOpen, setPayOpen] = useState(false);
  const [payMethods, setPayMethods] = useState<PaymentMethodLite[]>([]);
  const [payMethodId, setPayMethodId] = useState('');
  const [paySender, setPaySender] = useState('');
  const [payTxn, setPayTxn] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  /* Multi-price products: the buyer must pick an option before ordering */
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  /* Share: native share sheet on mobile, popover fallback (copy/WhatsApp/Facebook) on desktop */
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const isMulti = product?.productType === 'multi' && (product.options?.length ?? 0) > 0;
  const availableOptions = useMemo(
    () => (product?.options ?? []).filter((o) => o.isAvailable),
    [product?.options]
  );
  const selectedOption = useMemo(
    () => (isMulti ? product?.options?.find((o) => o.id === selectedOptionId) ?? null : null),
    [isMulti, product?.options, selectedOptionId]
  );
  /* The unit price the buyer sees — always from the selected option (multi)
     or the product price (single). Never editable by hand. */
  const unitPrice = isMulti ? (selectedOption?.price ?? null) : (product?.price ?? 0);
  /* Digital product state */
  const [entitled, setEntitled] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const isDigital = !!product?.hasFile;
  const isFreeDigital = isDigital && !!product?.isFree;

  /* Meta Pixel — ViewContent (browser-only; fires once per loaded product) */
  useEffect(() => {
    if (!product) return;
    const value = isMulti ? (selectedOption?.price ?? product.minPrice ?? product.price) : product.price;
    fbqTrack('ViewContent', {
      content_type: 'product',
      content_ids: [product.id],
      content_name: product.title,
      value,
      currency: 'BDT',
    }, genMetaEventId('vc'));
  }, [product?.id]);

  // Is the logged-in user already entitled to the digital file?
  useEffect(() => {
    if (!product || !user || !product.hasFile) { setEntitled(false); return; }
    let cancelled = false;
    fetch(`/api/download/${product.id}/info`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setEntitled(!!d.entitled); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?.id, product?.hasFile, user?.id]);

  useEffect(() => {
    if (!productDetailId) return;
    setLoading(true);
    setShowBuyConfirm(false);
    setDescExpanded(false);
    setPlacedOrder(null);
    setOrderReqId(null);
    setPayOpen(false);
    setProduct(null);
    setQty(1);
    setSelectedOptionId(null);
    fetch(`/api/products/${productDetailId}`)
      .then((r) => r.json())
      .then((d) => {
        setProduct(d.success ? d.product : null);
        // If exactly one option is available, preselect it so the buyer sees
        // a single clear price instead of an empty "select a package" state.
        const opts = d.success && d.product?.options ? d.product.options.filter((o: OrderProductOption) => o.isAvailable) : [];
        if (d.success && d.product?.productType === 'multi' && opts.length === 1) {
          setSelectedOptionId(opts[0].id);
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [productDetailId]);

  // Suggested products — other active products, same category first
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const all: OrderProduct[] = d.products || [];
        const others = all.filter((p) => p.id !== productDetailId);
        const cat = product?.category;
        if (cat) {
          others.sort((a, b) => (a.category === cat ? 0 : 1) - (b.category === cat ? 0 : 1));
        }
        setSuggested(others.slice(0, 8));
      })
      .catch(() => {});
  }, [productDetailId, product?.category]);

  // Follow status
  useEffect(() => {
    if (!product || !user || user.id === product.seller.id) { setFollowing(false); return; }
    fetch(`/api/seller/${product.seller.id}/public`)
      .then((r) => r.json()).then((d) => setFollowing(!!d.isFollowing)).catch(() => {});
  }, [product?.seller.id, user?.id]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error(t('marketplace.loginRequired')); setView('auth'); return; }
    if (!product) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/seller/${product.seller.id}/follow`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) { setFollowing(json.following); toast.success(json.following ? t('sellerProfile.following') : t('sellerProfile.follow')); }
      else toast.error(json.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setFollowLoading(false); }
  };

  const waNumber = product?.seller.whatsappNumber || null;
  const waHref = product ? waMeLink(waNumber, locale === 'bn'
    ? `হাই! আমি Midman মার্কেটপ্লেসে আপনার "${product.title}"${selectedOption ? ` (${selectedOption.name})` : ''} পণ্যটি${qty > 1 ? ` (${qty} পিস)` : ''} দেখলাম। বিস্তারিত জানতে চাই।`
    : `Hi! I saw your product "${product.title}"${selectedOption ? ` (${selectedOption.name})` : ''}${qty > 1 ? ` (quantity: ${qty})` : ''} on the Midman marketplace. I'd like to know more about it.`) : null;

  const handleBuyNow = () => {
    if (!user) { toast.error(t('marketplace.loginRequired')); setView('auth'); return; }
    /* Multi-price: an option MUST be selected before ordering */
    if (isMulti && !selectedOption) { toast.error(t('marketplace.selectPackageHint')); return; }
    setShowBuyConfirm(true);
  };

  /* ── Place a NORMAL marketplace order (POST /api/orders).
     NEVER creates a Deal / escrow — direct orders live in the
     seller's Orders dashboard, completely separate from Admin Deals. */
  const confirmBuy = async () => {
    if (!product) return;
    setShowBuyConfirm(false);
    /* Meta Pixel — InitiateCheckout (client-side analytics only) */
    fbqTrack('InitiateCheckout', {
      content_type: 'product',
      content_ids: [product.id],
      value: (unitPrice ?? product.price) * qty,
      currency: 'BDT',
      num_items: qty,
    }, genMetaEventId('ic'));

    // Idempotency key: generated once per checkout attempt — retries
    // (network error, double-click) return the SAME order, no duplicates.
    const reqId = orderReqId ?? `web_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    setOrderReqId(reqId);
    setPlacingOrder(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          optionId: selectedOption?.id,
          quantity: qty,
          clientRequestId: reqId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPlacedOrder(data.order as PlacedOrder);
        setPayOpen(false);
        setPaySender(''); setPayTxn(''); setPayMethodId('');
        toast.success(t('marketplace.orderPlaced'));
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
      setPlacingOrder(false);
    }
  };

  /* ── Inline payment submission for the just-placed order —
     the EXISTING manual payment endpoint (same one the SMM
     direct orders use): owner-only, unpaid-only, duplicate-txn
     guard, goes to awaiting_verification until an admin verifies. */
  const openPayForm = async () => {
    setPayOpen(true);
    if (payMethods.length > 0) return;
    try {
      const res = await fetch('/api/payment-methods');
      const json = await res.json().catch(() => null);
      const list: PaymentMethodLite[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.methods)
          ? json.methods
          : [];
      const active = list.filter((m) => m && m.id && m.name);
      setPayMethods(active);
      if (active.length > 0) setPayMethodId((cur) => cur || active[0].id);
    } catch { /* form still usable — method optional */ }
  };

  const submitOrderPayment = async () => {
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
        setPayOpen(false);
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

  /** Go to the buyer's My Orders dashboard panel */
  const goMyOrders = () => {
    const store = useAppStore.getState();
    store.setDashboardPanel('my-orders');
    store.setView('dashboard');
  };

  /* Existing Admin Deal route — the generic escrow workflow (no prefill),
     exactly what the sidebar's Admin Deal item does. */
  const handleAdminDeal = () => {
    const s = useAppStore.getState();
    if (!s.user) { toast.error(t('marketplace.loginRequired')); s.setView('auth'); return; }
    s.setDashboardPanel('new-deal');
    s.setView('dashboard');
  };

  /** Free product → claim + open the download page */
  const claimFreeDownload = async () => {
    if (!product) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/products/${product.id}/claim`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        const store = useAppStore.getState();
        store.setDownloadProductId(product.id);
        store.setView('page-download');
      } else if (res.status === 401) {
        toast.error(t('download.loginRequired'));
        setView('auth');
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setClaiming(false);
    }
  };

  /** Open the download page (already entitled) */
  const openDownload = () => {
    if (!product) return;
    const store = useAppStore.getState();
    store.setDownloadProductId(product.id);
    store.setView('page-download');
  };

  const openProduct = (id: string) => {
    useAppStore.getState().setProductDetailId(id);
  };

  const openSellerProfile = () => {
    if (!product) return;
    const store = useAppStore.getState();
    store.setSellerProfileId(product.seller.id);
    store.setView('page-seller-profile');
  };

  /* ── Share ────────────────────────────────────────────────────────────
     Mobile: native share sheet (any installed app).
     Desktop / unsupported: popover with Copy Link, WhatsApp, Facebook.
     The shared URL always points at the SEO route /product/{id}. */
  const getProductUrl = () =>
    `${window.location.origin}/product/${product?.id ?? productDetailId ?? ''}`;

  const toggleShare = async () => {
    if (!product) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: product.title,
          text: t('marketplace.shareText', { title: product.title }),
          url: getProductUrl(),
        });
        return;
      } catch (err) {
        // User closed the native sheet — do not open the fallback popover
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    setShareOpen((o) => !o);
  };

  const copyShareLink = async () => {
    const url = getProductUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API blocked (http / iframe) — legacy fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast.success(t('marketplace.shareCopied'));
    setShareOpen(false);
  };

  const shareOnWhatsApp = () => {
    const text = `${t('marketplace.shareText', { title: product?.title ?? '' })} ${getProductUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setShareOpen(false);
  };

  const shareOnFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getProductUrl())}`,
      '_blank', 'noopener,noreferrer,width=620,height=540'
    );
    setShareOpen(false);
  };

  // Close the share popover on outside click / Escape
  useEffect(() => {
    if (!shareOpen) return;
    const onDown = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShareOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [shareOpen]);

  /* ── Loading skeleton — same shape as the real layout ── */
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted/60" />
          <div className="space-y-4">
            <div className="h-6 w-40 animate-pulse rounded-full bg-muted/60" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted/60" />
            <div className="h-9 w-32 animate-pulse rounded bg-muted/60" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-muted/60" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted/60" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted/60" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Not found — marketplace-styled, no site chrome ── */
  if (!product) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{t('marketplace.productNotFound')}</p>
        <Button variant="outline" onClick={() => setView('page-marketplace')} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />{t('sellerProfile.backToMarketplace')}
        </Button>
      </div>
    );
  }

  const catMeta = CATEGORIES.find((c) => c.key === product.category);
  const CatIcon = catMeta?.Icon ?? Package;
  const catName = catMeta ? catMeta[locale === 'bn' ? 'bn' : 'en'] : product.category;
  const gradientBg = CATEGORY_BG[product.category] || CATEGORY_BG.other;
  const longDesc = product.description.length > DESC_CLAMP_CHARS;
  const listedDate = new Date(product.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pb-10 lg:px-8">
      {/* Desktop back-to-marketplace row (mobile back lives in the header) */}
      <div className="mb-4 hidden md:block">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border/50 px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:border-border/30"
        >
          <ArrowLeft className="h-4 w-4" />
          {backTargetProfile ? t('sellerProfile.backToSeller') : t('sellerProfile.backToMarketplace')}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid gap-6 lg:grid-cols-2 lg:gap-10"
      >
        {/* ── Product image — real image, object-contain (no crop/stretch);
               no image → the Marketplace category gradient placeholder ── */}
        <div className="relative self-start overflow-hidden rounded-2xl border border-border/40 shadow-sm lg:sticky lg:top-4 dark:border-border/20">
          {product.image ? (
            <img
              src={cdnUrl(product.image) || ''}
              alt={product.title}
              className="aspect-[4/3] w-full bg-white object-contain"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className={`flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br ${gradientBg}`}>
              <CatIcon className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.1} />
            </div>
          )}
        </div>

        {/* ── Product information + purchase actions ── */}
        <div className="flex min-w-0 flex-col">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              <CatIcon className="h-3 w-3" />
              {catName}
            </span>
            {product.hasFile && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">
                <FileDown className="h-3 w-3 text-primary" />
                {t('marketplace.digitalProduct')}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[11px] font-semibold">{t('marketplace.verified')}</span>
            </span>
            {/* Share — native sheet on mobile, popover fallback on desktop */}
            <div className="relative ml-auto" ref={shareRef}>
              <button
                type="button"
                onClick={toggleShare}
                aria-label={t('marketplace.share')}
                title={t('marketplace.share')}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:border-border/30"
              >
                <Share2 className="h-4 w-4" />
              </button>
              {shareOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-xl border border-border/50 bg-popover shadow-lg dark:border-border/30"
                >
                  <button type="button" onClick={copyShareLink} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    {t('marketplace.shareCopy')}
                  </button>
                  <button type="button" onClick={shareOnWhatsApp} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent">
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    {t('marketplace.shareWhatsApp')}
                  </button>
                  <button type="button" onClick={shareOnFacebook} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent">
                    <Facebook className="h-4 w-4 text-[#1877F2]" />
                    {t('marketplace.shareFacebook')}
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          <h1 className="mt-3 text-xl font-bold leading-snug text-foreground sm:text-2xl">{product.title}</h1>

          {/* Price — free / multi range / unit × qty (never hand-edited) */}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {product.isFree ? (
              <p className="text-2xl font-extrabold text-emerald-600 sm:text-3xl dark:text-emerald-400">{t('marketplace.free')}</p>
            ) : isMulti && !selectedOption ? (
              <p className="text-2xl font-extrabold text-primary sm:text-3xl">
                {product.minPrice === product.maxPrice
                  ? formatPrice(product.price)
                  : `${formatPrice(product.minPrice ?? product.price)} – ${formatPrice(product.maxPrice ?? product.price)}`}
              </p>
            ) : (
              <>
                <p className="text-2xl font-extrabold text-primary sm:text-3xl">{formatPrice((unitPrice ?? product.price) * qty)}</p>
                {isMulti && selectedOption && (
                  <p className="text-[13px] font-semibold text-foreground">{selectedOption.name}</p>
                )}
                {qty > 1 && unitPrice !== null && (
                  <p className="text-[13px] font-medium text-muted-foreground">{formatPrice(unitPrice)} × {qty}</p>
                )}
              </>
            )}
          </div>
          {!isMulti && (product.minPrice !== undefined && product.maxPrice !== undefined && product.minPrice !== product.maxPrice) && (
            <p className="mt-1 text-[12px] font-medium text-muted-foreground">
              {formatPrice(product.minPrice)} – {formatPrice(product.maxPrice)}
            </p>
          )}

          {/* Seller row — real seller data + existing follow / profile APIs */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 dark:border-border/25">
            <button type="button" onClick={openSellerProfile} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={cdnUrl(product.seller.imageLink) || undefined} />
                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{product.seller.name}</p>
                <p className="text-[11px] text-muted-foreground">{t('marketplace.seller')}</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {user && user.id !== product.seller.id && (
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                    following
                      ? 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20'
                      : 'bg-primary/10 text-primary hover:bg-primary/15'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${following ? 'fill-red-500' : ''}`} />
                  {followLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : (following ? t('sellerProfile.following') : t('sellerProfile.follow'))}
                </button>
              )}
              <button
                type="button"
                onClick={openSellerProfile}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />{t('sellerProfile.viewProfile')}
              </button>
            </div>
          </div>

          {/* Option selector — multi-price products only.
              Touch-friendly rounded cards; price updates instantly on change. */}
          {isMulti && (
            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-[13px] font-bold text-foreground">{t('marketplace.selectPackage')}</p>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">{t('marketplace.selectPackageHint')}</p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {product.options!.map((opt) => {
                  const selected = opt.id === selectedOptionId;
                  const unavailable = !opt.isAvailable;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={unavailable}
                      onClick={() => setSelectedOptionId(opt.id)}
                      aria-pressed={selected}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed ${
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border/40 bg-card hover:border-primary/40 dark:border-border/25'
                      } ${unavailable ? 'opacity-45' : ''}`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                        <span className={`truncate text-[13px] font-semibold ${selected ? 'text-primary' : 'text-foreground'}`}>{opt.name}</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-foreground">
                        {unavailable ? (
                          <span className="text-[11px] font-medium text-muted-foreground">{t('seller.optionUnavailable')}</span>
                        ) : (
                          formatPrice(opt.price)
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {availableOptions.length === 0 && (
                <p className="mt-2 text-[12px] font-medium text-destructive">{t('seller.optionUnavailable')}</p>
              )}
            </div>
          )}

          {/* Quantity — order-time selection only (no stock). Hidden for
              single-price digital files (a file ×N is meaningless), but
              ALWAYS shown for multi-price products. */}
          {(!isDigital || isMulti) && (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><Boxes className="h-4 w-4" />{t('marketplace.quantity')}</span>
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
                    onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                    disabled={qty >= MAX_QTY}
                    className="flex h-10 w-10 items-center justify-center text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Action area — Order Now · Admin Deal · Message (plus the
                 existing digital claim/download and order-confirm states) ── */}
          <div className="mt-5">
            {placedOrder ? (
              /* ── Order placed — success card (normal marketplace order, NOT a deal) ── */
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{t('marketplace.orderPlacedTitle')}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {t('marketplace.orderPlacedDesc', { amount: formatPrice(placedOrder.totalAmount) })}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 font-mono text-[11px] font-bold text-foreground">
                        {placedOrder.orderNumber}
                      </span>
                      {placedOrder.optionName && (
                        <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                          {placedOrder.optionName} · ×{placedOrder.quantity.toLocaleString('en')}
                        </span>
                      )}
                      {placedOrder.quantity > 1 && !placedOrder.optionName && (
                        <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                          ×{placedOrder.quantity.toLocaleString('en')}
                        </span>
                      )}
                    </div>
                    {placedOrder.paymentStatus === 'unpaid' && (
                      <p className="mt-2 text-[12px] font-medium text-amber-600 dark:text-amber-400">
                        {t('orders.unpaidWarning')}
                      </p>
                    )}
                  </div>
                </div>

                {placedOrder.paymentStatus === 'unpaid' ? (
                  payOpen ? (
                    /* Payment form — mirrors the existing manual payment fields (method, sender, txn) */
                    <div className="mt-3 space-y-2.5 rounded-lg border border-border bg-background p-3">
                      {payMethods.length > 0 && (
                        <div className="space-y-1">
                          <Label htmlFor="order-pay-method" className="text-[12px] font-medium text-muted-foreground">{t('orders.paymentMethod')}</Label>
                          <select
                            id="order-pay-method"
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
                          <Label htmlFor="order-pay-sender" className="text-[12px] font-medium text-muted-foreground">{t('orders.senderNumber')}</Label>
                          <Input id="order-pay-sender" value={paySender} onChange={(e) => setPaySender(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" className="h-10" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="order-pay-txn" className="text-[12px] font-medium text-muted-foreground">{t('orders.transactionId')}</Label>
                          <Input id="order-pay-txn" value={payTxn} onChange={(e) => setPayTxn(e.target.value)} placeholder={t('orders.txnPlaceholder')} className="h-10" />
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{t('orders.paymentVerifyNote')}</p>
                      <div className="flex gap-2">
                        <Button onClick={submitOrderPayment} disabled={paySubmitting} className="flex-1 gap-2 rounded-xl text-[13px] font-semibold">
                          {paySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                          {t('orders.submitPayment')}
                        </Button>
                        <Button onClick={() => setPayOpen(false)} variant="outline" disabled={paySubmitting} className="rounded-xl text-[13px] font-semibold">
                          {t('marketplace.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Button onClick={openPayForm} className="flex-1 gap-2 rounded-xl text-[13px] font-semibold">
                        <Wallet className="h-4 w-4" />
                        {t('orders.submitPayment')}
                      </Button>
                      <Button onClick={goMyOrders} variant="outline" className="flex-1 rounded-xl text-[13px] font-semibold">
                        {t('orders.goMyOrders')}
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Clock3 className="h-4 w-4" />
                    {t('orders.paymentVerifying')}
                  </div>
                )}
              </div>
            ) : entitled ? (
              <Button onClick={openDownload} className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25">
                <Download className="h-5 w-5" />
                {t('marketplace.downloadNow')}
              </Button>
            ) : isFreeDigital ? (
              <div className="space-y-2">
                <Button onClick={claimFreeDownload} disabled={claiming} className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25">
                  {claiming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                  {claiming ? t('download.claiming') : t('marketplace.freeDownload')}
                </Button>
                <p className="text-center text-[12px] text-muted-foreground">{t('marketplace.freeDownloadHint')}</p>
              </div>
            ) : showBuyConfirm ? (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"><ShoppingCart className="h-5 w-5 text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{t('marketplace.orderConfirmTitle')}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{t('marketplace.orderConfirmDesc', { amount: formatPrice((unitPrice ?? product.price) * qty) })}</p>
                    {selectedOption && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                        {selectedOption.name} · {formatPrice(selectedOption.price)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmBuy} disabled={placingOrder} className="flex-1 gap-2 rounded-xl py-4 text-[14px] font-semibold">
                    {placingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {placingOrder ? t('marketplace.placingOrder') : t('marketplace.orderConfirmYes')}
                  </Button>
                  <Button onClick={() => setShowBuyConfirm(false)} variant="outline" disabled={placingOrder} className="flex-1 rounded-xl py-4 text-[14px] font-semibold">
                    {t('marketplace.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Order Now — creates a NORMAL marketplace order (never a Deal);
                    the seller sees it in their Dashboard Orders page */}
                <Button
                  onClick={handleBuyNow}
                  disabled={isMulti && !selectedOption}
                  className="h-12 w-full gap-2 rounded-xl text-[15px] font-bold shadow-lg shadow-primary/25"
                >
                  <ShoppingCart className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">
                    {t('marketplace.orderNow')}
                    {isMulti && selectedOption ? ` — ${formatPrice(selectedOption.price * qty)}` : ''}
                  </span>
                </Button>
                {/* Secondary row — Admin Deal (existing route) + Message (existing WhatsApp contact) */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleAdminDeal}
                    className="h-11 gap-1.5 rounded-xl border-border/60 text-[13px] font-semibold dark:border-border/35"
                  >
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="truncate">{t('nav.newDeal')}</span>
                  </Button>
                  {waHref ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent dark:border-border/35"
                    >
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <span className="truncate">{t('marketplace.message')}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title={t('marketplace.noContact')}
                      className="flex h-11 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-border/60 text-[13px] font-semibold text-muted-foreground opacity-60 dark:border-border/35"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="truncate">{t('marketplace.message')}</span>
                    </button>
                  )}
                </div>
                {isDigital && (
                  <p className="flex items-center justify-center gap-1.5 pt-1 text-[12px] text-muted-foreground">
                    <FileDown className="h-3.5 w-3.5 text-primary" />
                    {t('marketplace.digitalHint')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Description — full content width, Read More / Show Less ── */}
      <section className="mt-8 lg:mt-10" aria-labelledby="pdp-description">
        <h2 id="pdp-description" className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
          <FileText className="h-4 w-4 text-primary" strokeWidth={2.2} />
          {t('marketplace.description')}
        </h2>
        <div className="mt-2.5 rounded-xl border border-border/40 bg-card p-4 dark:border-border/25">
          <p className={`whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/90 ${longDesc && !descExpanded ? 'line-clamp-6' : ''}`}>
            {product.description}
          </p>
          {longDesc && (
            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              aria-expanded={descExpanded}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-primary transition-colors hover:text-primary/80"
            >
              {descExpanded ? t('marketplace.showLess') : t('marketplace.readMore')}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${descExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </section>

      {/* ── Product details — only metadata the model really has ── */}
      <section className="mt-6" aria-labelledby="pdp-details">
        <h2 id="pdp-details" className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" strokeWidth={2.2} />
          {t('marketplace.productDetails')}
        </h2>
        <dl className="mt-2.5 divide-y divide-border/40 overflow-hidden rounded-xl border border-border/40 bg-card dark:divide-border/20 dark:border-border/25">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-[12px] font-medium text-muted-foreground">{t('marketplace.categories')}</dt>
            <dd className="truncate text-[13px] font-semibold text-foreground">{catName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-[12px] font-medium text-muted-foreground">{t('marketplace.seller')}</dt>
            <dd className="truncate text-[13px] font-semibold text-foreground">{product.seller.name}</dd>
          </div>
          {isDigital && product.fileName && (
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="shrink-0 text-[12px] font-medium text-muted-foreground">{t('marketplace.digitalProduct')}</dt>
              <dd className="truncate text-[13px] font-semibold text-foreground">
                {product.fileName}
                {product.fileSize ? ` · ${formatBytes(product.fileSize)}` : ''}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-[12px] font-medium text-muted-foreground">{t('marketplace.listedOn')}</dt>
            <dd className="truncate text-[13px] font-semibold text-foreground">{listedDate}</dd>
          </div>
        </dl>
      </section>

      {/* ── Suggested products — same-category-first, marketplace cards ── */}
      {suggested.length > 0 && (
        <section className="mt-10" aria-label={t('marketplace.suggestedProducts')}>
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4 text-primary" strokeWidth={2.2} />
            <h2 className="text-[15px] font-bold text-foreground">{t('marketplace.suggestedProducts')}</h2>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="list">
            {suggested.map((p) => {
              const sCat = CATEGORIES.find((c) => c.key === p.category);
              const SCatIcon = sCat?.Icon ?? Package;
              const sName = sCat ? sCat[locale === 'bn' ? 'bn' : 'en'] : p.category;
              const sGradient = CATEGORY_BG[p.category] || CATEGORY_BG.other;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProduct(p.id)}
                  role="listitem"
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/30 bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06] dark:border-border/20"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-white">
                    {p.image ? (
                      <img src={cdnUrl(p.image) || ''} alt={p.title} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${sGradient}`}>
                        <SCatIcon className={`h-10 w-10 ${sCat?.color ?? 'text-muted-foreground/40'} opacity-40`} strokeWidth={1.2} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-2.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">{sName}</span>
                    <h3 className="line-clamp-1 text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">{p.title}</h3>
                    <span className="block text-[14px] font-extrabold text-primary">
                      {p.isFree
                        ? t('marketplace.free')
                        : p.productType === 'multi' && p.minPrice !== undefined && p.maxPrice !== undefined && p.minPrice !== p.maxPrice
                          ? `${formatPrice(p.minPrice)} – ${formatPrice(p.maxPrice)}`
                          : formatPrice(p.price)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
