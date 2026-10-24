'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Star, Users, Package, Heart, Loader2,
  Send, ShieldCheck, BadgeCheck, Flag, Search, Store, Info, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { PageWrapper } from './page-wrapper';
import { Footer } from './footer';

/* ── Category labels (mirror the marketplace category system) ── */
const STORE_CATEGORIES: Record<string, { bn: string; en: string }> = {
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

const REPORT_REASONS = [
  { key: 'abusive', labelKey: 'sellerProfile.reasonAbusive' },
  { key: 'fraudulent', labelKey: 'sellerProfile.reasonFraudulent' },
  { key: 'irrelevant', labelKey: 'sellerProfile.reasonIrrelevant' },
  { key: 'spam', labelKey: 'sellerProfile.reasonSpam' },
  { key: 'other', labelKey: 'sellerProfile.reasonOther' },
] as const;

interface SellerInfo {
  id: string; name: string; imageLink: string | null;
  businessName: string | null; businessBio: string | null;
  sellerRole?: string | null; businessVerified?: boolean;
  businessCategory?: string | null; storeLogo?: string | null; publicContact?: string | null;
}
interface Product {
  id: string; title: string; description: string; price: number;
  category: string; image: string | null; createdAt: string;
}
interface Review {
  id: string; rating: number; comment: string; createdAt: string;
  orderId: string | null; sellerReply: string | null; sellerReplyAt: string | null;
  user: { id: string; name: string; imageLink: string | null };
}
interface EligibleOrder {
  id: string; orderNumber: string; serviceName: string; totalAmount: number;
  completedAt: string | null; reviewed: boolean;
  myReview?: { rating: number; comment: string } | null;
}

interface ProfileData {
  storeStatus: 'active' | 'suspended';
  seller: SellerInfo;
  products: Product[];
  followerCount: number;
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  isFollowing: boolean;
  hasReviewed: boolean;
  eligibleOrders: EligibleOrder[];
}

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'name';

export function SellerProfileView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const sellerId = useAppStore((s) => s.sellerProfileId);
  const setView = useAppStore((s) => s.setView);
  const setProductDetailId = useAppStore((s) => s.setProductDetailId);

  /* Open the product's buy page — same flow as the marketplace grid */
  const openProductPage = (id: string) => {
    setProductDetailId(id);
    setView('page-product');
  };

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  // Product discovery
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  // Review form (verified-purchase only)
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Report dialog
  const [reportReviewId, setReportReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/seller/${sellerId}/public`);
      if (!res.ok) throw new Error('Not found');
      const json: ProfileData = await res.json();
      setData(json);
      setFollowing(json.isFollowing);
      setFollowerCount(json.followerCount);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFollow = async () => {
    if (!sellerId) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/seller/${sellerId}/follow`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setFollowing(json.following);
        setFollowerCount(json.followerCount);
      } else {
        toast.error(json.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Order selection pre-fills the edit form (explicit review-edit policy) ──
  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = data?.eligibleOrders.find(o => o.id === orderId);
    if (order?.reviewed && order.myReview) {
      setReviewRating(order.myReview.rating);
      setReviewComment(order.myReview.comment);
    } else {
      setReviewRating(5);
      setReviewComment('');
    }
  };

  const selectedOrder = data?.eligibleOrders.find(o => o.id === selectedOrderId);
  const isEditingReview = !!selectedOrder?.reviewed;

  const handleSubmitReview = async () => {
    if (!sellerId || !selectedOrderId) return;
    if (!reviewComment.trim()) { toast.error(t('sellerProfile.writeComment')); return; }
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/seller/${sellerId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim(), orderId: selectedOrderId }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(isEditingReview ? t('sellerProfile.reviewUpdated') : t('sellerProfile.reviewAdded'));
        setReviewComment('');
        setReviewRating(5);
        setSelectedOrderId('');
        fetchProfile();
      } else {
        toast.error(json.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReviewId || !reportReason) return;
    setSubmittingReport(true);
    try {
      const res = await fetch(`/api/seller-review/${reportReviewId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(t('sellerProfile.reportSubmitted'));
        setReportReviewId(null);
        setReportReason('');
        setReportDetails('');
      } else {
        toast.error(json.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setSubmittingReport(false);
    }
  };

  /* ── Product discovery (client-side over the store's published products) ── */
  const productCategories = useMemo(() => {
    if (!data) return [];
    const cats = Array.from(new Set(data.products.map(p => p.category)));
    return cats.filter(c => STORE_CATEGORIES[c]);
  }, [data]);

  const visibleProducts = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    let list = data.products.filter(p => {
      if (activeCat !== 'all' && p.category !== activeCat) return false;
      if (q && !(`${p.title} ${p.description}`.toLowerCase().includes(q))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'name': return a.title.localeCompare(b.title, 'bn');
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return list;
  }, [data, searchQuery, activeCat, sortKey]);

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="h-9 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 flex flex-col items-center gap-6">
          <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-60 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <PageWrapper>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t('sellerProfile.notFound')}</p>
        </div>
      </PageWrapper>
    );
  }

  /* ── Suspended store state (Phase 8: restricted storefront) ── */
  if (data.storeStatus === 'suspended') {
    return (
      <PageWrapper>
        <div className="mx-auto w-full max-w-lg px-4 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/10">
            <Store className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{t('sellerProfile.storeSuspendedTitle')}</h1>
          <p className="text-sm text-muted-foreground mb-1">
            {data.seller.businessName || data.seller.name}
          </p>
          <p className="text-sm text-muted-foreground mb-8">{t('sellerProfile.storeSuspendedDesc')}</p>
          <Button
            onClick={() => setView('page-marketplace')}
            variant="outline"
            className="rounded-xl font-semibold gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('sellerProfile.backToMarketplace')}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const { seller, products, reviews, avgRating, reviewCount, eligibleOrders } = data;
  const isOwnStore = user?.id === seller.id;
  const displayLogo = seller.storeLogo || seller.imageLink;

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
        {/* ── Store Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl bg-card border border-border/50 p-6 sm:p-8 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="shrink-0">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl ring-4 ring-primary/10">
                <AvatarImage src={cdnUrl(displayLogo || '') || undefined} alt={seller.businessName || seller.name} />
                <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary rounded-2xl">
                  {(seller.businessName || seller.name).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xl sm:text-2xl font-bold text-foreground">
                <span className="truncate">{seller.businessName || seller.name}</span>
                {seller.businessVerified && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t('seller.verifiedBusinessBadge')}
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{seller.name}</p>

              {seller.businessCategory && STORE_CATEGORIES[seller.businessCategory] && (
                <div className="mt-2">
                  <Badge variant="outline" className="rounded-full text-xs font-medium border-primary/30 text-primary bg-primary/5">
                    {locale === 'bn' ? STORE_CATEGORIES[seller.businessCategory].bn : STORE_CATEGORIES[seller.businessCategory].en}
                  </Badge>
                </div>
              )}

              {seller.businessBio && (
                <p className="text-sm text-muted-foreground mt-2 max-w-lg">{seller.businessBio}</p>
              )}

              {seller.publicContact && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{seller.publicContact}</span>
                </div>
              )}

              <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="font-semibold text-foreground">{avgRating}</span>
                  <span>({reviewCount})</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{followerCount}</span>
                  <span>{t('sellerProfile.followers')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{products.length}</span>
                  <span>{t('sellerProfile.products')}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              {user && user.id !== seller.id && (
                <Button
                  onClick={handleFollow}
                  disabled={followLoading}
                  variant={following ? 'outline' : 'default'}
                  className={`gap-2 rounded-xl ${following ? '' : 'shadow-lg shadow-primary/25'}`}
                >
                  {followLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${following ? 'fill-red-500 text-red-500' : ''}`} />}
                  {following ? t('sellerProfile.following') : t('sellerProfile.follow')}
                </Button>
              )}
            </div>
          </div>

          {/* Verification scope note — verified identity ≠ product guarantee */}
          {seller.businessVerified && (
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground/70 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                {t('sellerProfile.identityNote')}
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Products: search + category filter + sort ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-8"
        >
          <h2 className="text-lg font-bold text-foreground mb-4">{t('sellerProfile.allProducts')}</h2>

          {products.length > 0 && (
            <div className="mb-4 space-y-3">
              <div className="flex gap-2 flex-col sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('sellerProfile.searchProducts')}
                    className="pl-9 h-11 rounded-xl bg-card"
                  />
                </div>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                  aria-label={t('sellerProfile.sortBy')}
                >
                  <option value="newest">{t('sellerProfile.sortNewest')}</option>
                  <option value="price_asc">{t('sellerProfile.sortPriceLow')}</option>
                  <option value="price_desc">{t('sellerProfile.sortPriceHigh')}</option>
                  <option value="name">{t('sellerProfile.sortName')}</option>
                </select>
              </div>

              {productCategories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setActiveCat('all')}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                      activeCat === 'all'
                        ? 'bg-primary/10 border-2 border-primary/30 text-primary'
                        : 'border-border/50 bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('sellerProfile.allCategories')}
                  </button>
                  {productCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCat(cat)}
                      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                        activeCat === cat
                          ? 'bg-primary/10 border-2 border-primary/30 text-primary'
                          : 'border-border/50 bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {locale === 'bn' ? STORE_CATEGORIES[cat].bn : STORE_CATEGORIES[cat].en}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {products.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-border/40">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('sellerProfile.noProducts')}</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-border/40">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('sellerProfile.noProductsFound')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {visibleProducts.map((p) => (
                <a
                  key={p.id}
                  href={`/product/${p.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    openProductPage(p.id);
                  }}
                  className="group rounded-xl border border-border/50 bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="aspect-square bg-muted/30 overflow-hidden">
                    {p.image ? (
                      <img
                        src={cdnUrl(p.image) || ''}
                        alt={p.title}
                        className="h-full w-full bg-white object-contain"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-foreground truncate">{p.title}</h3>
                    <p className="text-sm font-bold text-primary mt-1">৳{p.price.toLocaleString('en-BD')}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Reviews ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-8"
        >
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-foreground">
              {t('sellerProfile.reviews')} ({reviewCount})
            </h2>
            {reviewCount > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="font-semibold text-foreground">{avgRating}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-4">{t('sellerProfile.verifiedOnlyDesc')}</p>

          {/* Write review — verified buyers only */}
          {user && !isOwnStore && (
            eligibleOrders.length === 0 ? (
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4 sm:p-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <BadgeCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t('sellerProfile.verifiedOnly')}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('sellerProfile.noEligibleOrders')}. {t('sellerProfile.verifiedOnlyDesc')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card p-4 sm:p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{t('sellerProfile.writeReview')}</h3>
                </div>

                {/* Eligible completed order selector */}
                <div className="space-y-1.5 mb-3">
                  <label className="text-xs font-medium text-muted-foreground">{t('sellerProfile.selectOrder')}</label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => handleOrderSelect(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                  >
                    <option value="">—</option>
                    {eligibleOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.serviceName} · {o.orderNumber} · {o.completedAt ? new Date(o.completedAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}{o.reviewed ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                  {isEditingReview && (
                    <p className="text-[11px] text-primary/80">{t('sellerProfile.editReviewHint')}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewRating(s)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star className={`h-5 w-5 ${s <= reviewRating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder={t('sellerProfile.reviewPlaceholder')}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex justify-end mt-3">
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submittingReview || !selectedOrderId || !reviewComment.trim()}
                    size="sm"
                    className="gap-2 rounded-xl shadow-lg shadow-primary/25"
                  >
                    {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isEditingReview ? t('sellerProfile.reviewUpdated') : t('sellerProfile.submitReview')}
                  </Button>
                </div>
              </div>
            )
          )}

          {!user && (
            <p className="text-sm text-muted-foreground mb-6">
              {t('sellerProfile.loginToReview')}
            </p>
          )}

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <div className="text-center py-10 rounded-xl border border-dashed border-border/40">
              <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('sellerProfile.noReviews')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {reviews.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border/50 bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={r.user.imageLink || undefined} alt={r.user.name} />
                        <AvatarFallback className="text-xs font-bold bg-muted">
                          {r.user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-foreground truncate">{r.user.name}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= r.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20'}`} />
                            ))}
                          </div>
                          {r.orderId && (
                            <Badge className="gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-0 font-medium text-[10px] px-1.5 py-0 h-4">
                              <BadgeCheck className="h-3 w-3" />
                              {t('sellerProfile.verifiedPurchase')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{r.comment}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-[11px] text-muted-foreground/60">
                            {new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                          {user && r.user.id !== user.id && (
                            <button
                              onClick={() => { setReportReviewId(r.id); setReportReason(''); setReportDetails(''); }}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors"
                            >
                              <Flag className="h-3 w-3" />
                              {t('sellerProfile.reportReview')}
                            </button>
                          )}
                        </div>

                        {/* Public seller reply */}
                        {r.sellerReply && (
                          <div className="mt-3 rounded-lg bg-muted/40 border-l-2 border-primary/40 px-3 py-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Store className="h-3 w-3 text-primary" />
                              <span className="text-[11px] font-semibold text-primary">
                                {t('sellerProfile.sellerReply')}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/80">{r.sellerReply}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </main>

      {/* ── Report review dialog ── */}
      <Dialog open={!!reportReviewId} onOpenChange={(open) => { if (!open) setReportReviewId(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{t('sellerProfile.reportTitle')}</DialogTitle>
            <DialogDescription className="text-xs">{t('sellerProfile.reportDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{t('sellerProfile.reportReason')}</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
              >
                <option value="">{t('sellerProfile.selectReason')}</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.key} value={r.key}>{t(r.labelKey as never)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{t('sellerProfile.reportDetails')}</label>
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                maxLength={500}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setReportReviewId(null)}>
                {t('marketplace.cancel')}
              </Button>
              <Button
                size="sm"
                className="rounded-xl gap-2"
                disabled={!reportReason || submittingReport}
                onClick={handleSubmitReport}
              >
                {submittingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                {t('sellerProfile.reportSubmit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
