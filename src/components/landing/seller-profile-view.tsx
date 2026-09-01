'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Home, ArrowLeft, Star, Users, Package, Heart, Loader2,
  Send, MapPin, Calendar, ShieldCheck, MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { PageWrapper } from './page-wrapper';
import { Footer } from './footer';

interface SellerInfo {
  id: string; name: string; imageLink: string | null; businessName: string | null;
}
interface Product {
  id: string; title: string; description: string; price: number;
  category: string; image: string | null; createdAt: string;
}
interface Review {
  id: string; rating: number; comment: string; createdAt: string;
  user: { id: string; name: string; imageLink: string | null };
}

interface ProfileData {
  seller: SellerInfo;
  products: Product[];
  followerCount: number;
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  isFollowing: boolean;
  hasReviewed: boolean;
}

export function SellerProfileView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const sellerId = useAppStore((s) => s.sellerProfileId);
  const setView = useAppStore((s) => s.setView);

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/seller/${sellerId}/public`);
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
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

  const handleSubmitReview = async () => {
    if (!sellerId) return;
    if (!reviewComment.trim()) { toast.error(t('sellerProfile.writeComment')); return; }
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/seller/${sellerId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(t('sellerProfile.reviewAdded'));
        setReviewComment('');
        setReviewRating(5);
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

  const { seller, products, reviews, avgRating, reviewCount, hasReviewed } = data;

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
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl bg-card border border-border/50 p-6 sm:p-8 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-primary/10">
              <AvatarImage src={seller.imageLink || undefined} alt={seller.name} />
              <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                {seller.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {seller.businessName || seller.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{seller.name}</p>

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
        </motion.div>

        {/* Products Grid */}
        {products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-8"
          >
            <h2 className="text-lg font-bold text-foreground mb-4">{t('sellerProfile.allProducts')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((p) => (
                <a
                  key={p.id}
                  href="/marketplace"
                  onClick={(e) => {
                    e.preventDefault();
                    setView('page-marketplace');
                  }}
                  className="group rounded-xl border border-border/50 bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="aspect-square bg-muted/30 overflow-hidden">
                    {p.image ? (
                      <img
                        src={cdnUrl(p.image) || ''}
                        alt={p.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-foreground truncate">{p.title}</h3>
                    <p className="text-sm font-bold text-primary mt-1">৳{p.price.toLocaleString('bn-BD')}</p>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Reviews Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-8"
        >
          <h2 className="text-lg font-bold text-foreground mb-4">
            {t('sellerProfile.reviews')} ({reviewCount})
          </h2>

          {/* Write review form */}
          {user && user.id !== seller.id && (
            <div className="rounded-xl border border-border/50 bg-card p-4 sm:p-5 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('sellerProfile.writeReview')}</h3>
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
                  disabled={submittingReview || !reviewComment.trim()}
                  size="sm"
                  className="gap-2 rounded-xl shadow-lg shadow-primary/25"
                >
                  {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('sellerProfile.submitReview')}
                </Button>
              </div>
            </div>
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
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground truncate">{r.user.name}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= r.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{r.comment}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                          {new Date(r.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
