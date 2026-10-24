'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Star, Loader2, BadgeCheck, MessageSquareReply, Store, EyeOff, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';

interface SellerReviewRow {
  id: string;
  rating: number;
  comment: string;
  status: string;
  createdAt: string;
  sellerReply: string | null;
  sellerReplyAt: string | null;
  order: { id: string; orderNumber: string; title: string } | null;
  user: { id: string; name: string; imageLink: string | null };
}

/**
 * Seller dashboard panel — "My Reviews".
 * Sellers see their reviews (including hidden ones with a policy note) and can
 * post one public reply per review. Deleting reviews is intentionally impossible.
 */
export function SellerReviewsPanel() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const [reviews, setReviews] = useState<SellerReviewRow[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [savingReply, setSavingReply] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seller/my-reviews');
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews || []);
        setAvgRating(data.avgRating || 0);
        setReviewCount(data.reviewCount || 0);
        setHiddenCount(data.hiddenCount || 0);
        // Seed reply drafts with existing replies
        const drafts: Record<string, string> = {};
        for (const r of data.reviews || []) {
          if (r.sellerReply) drafts[r.id] = r.sellerReply;
        }
        setReplyDrafts(drafts);
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleSaveReply = async (reviewId: string, clear = false) => {
    const text = clear ? '' : (replyDrafts[reviewId] || '').trim();
    if (!clear && !text) return;
    setSavingReply(reviewId);
    try {
      const res = await fetch(`/api/seller-review/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('seller.replySaved'));
        setReplyOpen((s) => ({ ...s, [reviewId]: false }));
        loadReviews();
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setSavingReply(null);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('seller.myReviews')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('seller.myReviewsDesc')}</p>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/50 p-5 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
            <span className="text-2xl font-bold text-foreground">{avgRating}</span>
            <span className="text-sm text-muted-foreground">/ 5</span>
          </div>
          <div className="h-8 w-px bg-border/50" />
          <div className="text-sm text-muted-foreground">
            {reviewCount} {t('sellerProfile.reviews')}
            {hiddenCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                · {hiddenCount} {t('seller.hiddenReview')}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-2">{t('seller.avgFromPublished')}</p>
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="text-center py-14 rounded-2xl border border-dashed border-border/40">
          <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('seller.noReviewsYet')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const isHidden = r.status !== 'published';
            const hasReply = !!r.sellerReply;
            return (
              <div
                key={r.id}
                className={`rounded-2xl bg-white dark:bg-zinc-900 border p-4 sm:p-5 shadow-sm ${isHidden ? 'border-amber-300/60 dark:border-amber-500/20' : 'border-border/50'}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={r.user.imageLink ? cdnUrl(r.user.imageLink) || undefined : undefined} alt={r.user.name} />
                    <AvatarFallback className="text-sm font-bold bg-muted">
                      {r.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-foreground truncate">{r.user.name}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20'}`} />
                        ))}
                      </div>
                      {r.order && (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium text-[10px] px-1.5 py-0 h-4">
                          <BadgeCheck className="h-3 w-3" />
                          {t('sellerProfile.verifiedPurchase')}
                        </Badge>
                      )}
                      {isHidden && (
                        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium text-[10px] px-1.5 py-0 h-4">
                          <EyeOff className="h-3 w-3" />
                          {t('seller.hiddenReview')}
                        </Badge>
                      )}
                    </div>

                    {isHidden && (
                      <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mb-1">
                        {t('seller.hiddenReviewHint')}
                      </p>
                    )}

                    {r.order && (
                      <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 mb-1">
                        <Package className="h-3 w-3" />
                        {t('seller.reviewOfOrder')}: {r.order.title} ({r.order.orderNumber})
                      </p>
                    )}

                    <p className="text-sm text-muted-foreground">{r.comment}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1.5">{fmtDate(r.createdAt)}</p>

                    {/* Existing public reply */}
                    {hasReply && !replyOpen[r.id] && (
                      <div className="mt-3 rounded-lg bg-muted/40 border-l-2 border-primary/40 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Store className="h-3 w-3 text-primary" />
                          <span className="text-[11px] font-semibold text-primary">{t('sellerProfile.sellerReply')}</span>
                        </div>
                        <p className="text-xs text-foreground/80">{r.sellerReply}</p>
                      </div>
                    )}

                    {/* Reply editor */}
                    {replyOpen[r.id] ? (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          value={replyDrafts[r.id] || ''}
                          onChange={(e) => setReplyDrafts((s) => ({ ...s, [r.id]: e.target.value }))}
                          placeholder={t('seller.replyPlaceholder')}
                          rows={2}
                          maxLength={1000}
                          className="text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            onClick={() => setReplyOpen((s) => ({ ...s, [r.id]: false }))}
                          >
                            {t('marketplace.cancel')}
                          </Button>
                          {hasReply && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-xs"
                              disabled={savingReply === r.id}
                              onClick={() => handleSaveReply(r.id, true)}
                            >
                              {t('seller.removeReply')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="h-8 rounded-lg text-xs gap-1.5"
                            disabled={savingReply === r.id || !(replyDrafts[r.id] || '').trim()}
                            onClick={() => handleSaveReply(r.id)}
                          >
                            {savingReply === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareReply className="h-3.5 w-3.5" />}
                            {t('seller.saveReply')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs gap-1.5"
                          onClick={() => setReplyOpen((s) => ({ ...s, [r.id]: true }))}
                        >
                          <MessageSquareReply className="h-3.5 w-3.5" />
                          {hasReply ? t('seller.replyToReview') : t('seller.replyToReview')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
