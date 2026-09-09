'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, MessageCircle, ShieldCheck, ShoppingCart, Zap, Loader2, User,
  Eye, Heart, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { waMeLink } from '@/lib/wa-me';
import { PageWrapper } from './page-wrapper';
import { Footer } from './footer';

interface OrderProductSeller {
  id: string; name: string; email?: string; imageLink?: string | null; whatsappNumber?: string | null;
}
interface OrderProduct {
  id: string; title: string; description: string; price: number; category: string;
  image?: string | null; status: string; createdAt: string; seller: OrderProductSeller;
}

const CATEGORY_NAMES: Record<string, { bn: string; en: string }> = {
  design: { bn: 'ডিজাইন', en: 'Design' },
  development: { bn: 'ডেভেলপমেন্ট', en: 'Development' },
  content: { bn: 'কন্টেন্ট', en: 'Content' },
  marketing: { bn: 'মার্কেটিং', en: 'Marketing' },
  education: { bn: 'শিক্ষা', en: 'Education' },
  software: { bn: 'সফটওয়্যার', en: 'Software' },
  social_media: { bn: 'সোশ্যাল মিডিয়া', en: 'Social Media' },
  id: { bn: 'আইডি', en: 'ID' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

function formatPrice(price: number, locale: string): string {
  const formatted = price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return locale === 'bn'
    ? '৳' + formatted.replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d)])
    : '৳' + formatted;
}

export function ProductOrderView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const productDetailId = useAppStore((s) => s.productDetailId);
  const setView = useAppStore((s) => s.setView);

  const [product, setProduct] = useState<OrderProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggested, setSuggested] = useState<OrderProduct[]>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);

  useEffect(() => {
    if (!productDetailId) return;
    setLoading(true);
    setShowBuyConfirm(false);
    setProduct(null);
    fetch(`/api/products/${productDetailId}`)
      .then((r) => r.json())
      .then((d) => { setProduct(d.success ? d.product : null); })
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
        setSuggested(others.slice(0, 6));
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
    ? `হাই! আমি Midman মার্কেটপ্লেসে আপনার "${product.title}" পণ্যটি দেখলাম। বিস্তারিত জানতে চাই।`
    : `Hi! I saw your product "${product.title}" on the Midman marketplace. I'd like to know more about it.`) : null;

  const handleBuyNow = () => {
    if (!user) { toast.error(t('marketplace.loginRequired')); setView('auth'); return; }
    setShowBuyConfirm(true);
  };

  const confirmBuy = () => {
    if (!product) return;
    setShowBuyConfirm(false);
    const store = useAppStore.getState();
    store.setDealPreFill({
      title: product.title,
      amount: product.price,
      partyEmail: product.seller.email || '',
    });
    store.setDashboardPanel('new-deal');
    store.setView('dashboard');
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

  if (!product) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-muted-foreground">{t('marketplace.productNotFound')}</p>
          <Button variant="outline" onClick={() => setView('page-marketplace')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" />{t('sellerProfile.backToMarketplace')}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const catName = CATEGORY_NAMES[product.category]?.[locale === 'bn' ? 'bn' : 'en'] || product.category;

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
          {/* Product image */}
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-muted/30 shadow-sm">
            {product.image ? (
              <img src={cdnUrl(product.image) || ''} alt={product.title} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center"><Package className="h-16 w-16 text-muted-foreground/40" strokeWidth={1.2} /></div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 text-[11px] font-semibold">{catName}</Badge>
              <div className="flex items-center gap-1 text-primary"><ShieldCheck className="h-4 w-4" /><span className="text-[11px] font-medium">{t('marketplace.verified')}</span></div>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{product.title}</h1>
            <p className="mt-2 text-3xl font-extrabold text-primary">{formatPrice(product.price, locale)}</p>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{product.description}</p>

            {/* Seller box */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/30 bg-muted/30 p-3 dark:border-border/20 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={cdnUrl(product.seller.imageLink) || undefined} /><AvatarFallback><User className="h-5 w-5" /></AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{product.seller.name}</p>
                  {waNumber ? (
                    <p className="flex items-center gap-1 text-[12px] font-medium text-[#25D366]" dir="ltr"><MessageCircle className="h-3 w-3 shrink-0" />{waNumber}</p>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">{t('marketplace.seller')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                {user && user.id !== product.seller.id && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${following ? 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20' : 'bg-primary/10 text-primary hover:bg-primary/15'}`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${following ? 'fill-red-500' : ''}`} />
                    {followLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : (following ? t('sellerProfile.following') : t('sellerProfile.follow'))}
                  </button>
                )}
                <button
                  onClick={openSellerProfile}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Eye className="h-3.5 w-3.5" />{t('sellerProfile.viewProfile')}
                </button>
              </div>
            </div>

            {/* Order actions */}
            <div className="mt-5">
              {showBuyConfirm ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"><ShoppingCart className="h-5 w-5 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{t('marketplace.dealConfirmTitle')}</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">{t('marketplace.dealConfirmDesc', { amount: formatPrice(product.price, locale) })}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={confirmBuy} className="flex-1 gap-2 rounded-xl py-5 text-[14px] font-semibold">
                      <Zap className="h-4 w-4" />
                      {t('marketplace.dealConfirmYes')}
                    </Button>
                    <Button onClick={() => setShowBuyConfirm(false)} variant="outline" className="flex-1 rounded-xl py-5 text-[14px] font-semibold">
                      {t('marketplace.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {waHref && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-5 text-[14px] font-semibold text-white shadow-md shadow-[#25D366]/25 transition-colors hover:bg-[#1fb955]"
                    >
                      <MessageCircle className="h-4.5 w-4.5" />
                      {t('marketplace.contactWhatsApp')}
                    </a>
                  )}
                  <Button onClick={handleBuyNow} variant="outline" className="flex-1 gap-2 rounded-xl border-primary/30 py-5 text-[14px] font-semibold text-primary hover:bg-primary/5">
                    <ShoppingCart className="h-4.5 w-4.5" /> {t('marketplace.buyNow')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Suggested products */}
        {suggested.length > 0 && (
          <section className="mt-12 sm:mt-16" aria-label={t('marketplace.suggestedProducts')}>
            <div className="flex items-center gap-2">
              <Package className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
              <h2 className="text-[15px] font-bold text-foreground sm:text-base">{t('marketplace.suggestedProducts')}</h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {suggested.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProduct(p.id)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
                  role="listitem"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-muted/40">
                    {p.image ? (
                      <img src={cdnUrl(p.image) || ''} alt={p.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Package className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.2} /></div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{CATEGORY_NAMES[p.category]?.[locale === 'bn' ? 'bn' : 'en'] || p.category}</span>
                    <span className="line-clamp-2 text-[14px] font-semibold text-foreground">{p.title}</span>
                    <span className="mt-auto pt-1.5 text-base font-extrabold text-primary">{formatPrice(p.price, locale)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
