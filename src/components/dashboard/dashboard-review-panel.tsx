'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Loader2, Star, MessageSquare, CheckCircle2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

const emptySubscribe = () => () => {};

interface ReviewData {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${cls} ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewData }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 transition-colors hover:border-primary/20">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {review.name?.charAt(0) || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground truncate">{review.name}</p>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {new Date(review.createdAt).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <StarDisplay rating={review.rating} />
          <p className="mt-1.5 text-sm text-foreground/80 leading-relaxed line-clamp-3">{review.comment}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardReviewPanel() {
  const user = useAppStore((s) => s.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [existingReview, setExistingReview] = useState<ReviewData | null>(null);
  const [allReviews, setAllReviews] = useState<ReviewData[]>([]);

  // Load user's own review
  useEffect(() => {
    if (!user?.id) return;
    fetch('/api/reviews/my-review')
      .then((r) => r.json())
      .then((data) => {
        if (data.reviewed && data.review) {
          setExistingReview(data.review);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Load all public reviews
  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllReviews(data);
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (rating < 1 || comment.trim().length < 5) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setExistingReview(data.review);
        // Refresh all reviews
        const revRes = await fetch('/api/reviews');
        const revData = await revRes.json();
        if (Array.isArray(revData)) setAllReviews(revData);
        toast.success(t('review.submitted'));
      } else if (data.code === 'ALREADY_REVIEWED') {
        setExistingReview({ id: '', name: user?.name || '', rating, comment, createdAt: new Date().toISOString() });
        toast.info(t('review.alreadyReviewed'));
      } else {
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="text-center lg:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('review.dashboardTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('review.dashboardDesc')}</p>
      </div>

      {/* ── Give Review Card ── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 sm:p-6 border border-border/50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : existingReview ? (
          /* Already Reviewed */
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{t('review.thankYou')}</p>
                <p className="text-xs text-muted-foreground">{t('review.yourReviewDesc')}</p>
              </div>
            </div>
            <div className="rounded-xl bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{t('review.yourFeedback')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('review.givenOn')} {new Date(existingReview.createdAt).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <StarDisplay rating={existingReview.rating} size="md" />
              <p className="text-sm text-foreground/80 leading-relaxed">{existingReview.comment}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">{t('review.editNotAllowed')}</p>
          </div>
        ) : (
          /* Review Form */
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('review.rating')}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        s <= (hoverRating || rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('review.selectRating')}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">{t('review.comment')}</label>
                <span className={`text-xs ${comment.length > 500 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {t('review.charLimit', { current: comment.length })}
                </span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder={t('review.commentPlaceholder')}
                rows={4}
                className="w-full rounded-xl border border-border/50 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-none"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating < 1 || comment.trim().length < 5}
              className="h-11 w-full sm:w-auto gap-2 rounded-xl px-8 text-sm font-semibold shadow-md shadow-primary/20"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t('review.submitting')}</>
              ) : (
                <><Send className="h-4 w-4" />{t('review.submit')}</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── All Reviews List ── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 sm:p-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4.5 w-4.5 text-primary" />
            {t('review.sectionTitle')}
          </h3>
          {!reviewsLoading && (
            <span className="text-xs text-muted-foreground">{t('review.reviewCount', { count: allReviews.length })}</span>
          )}
        </div>

        {reviewsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : allReviews.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{t('review.noReviews')}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {allReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
