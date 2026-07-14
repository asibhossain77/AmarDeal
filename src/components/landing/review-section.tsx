'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send, MessageSquarePlus, Loader2, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

const PER_PAGE = 4;

function StarRating({
  value,
  onChange,
  size = 'md',
  interactive = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md';
  interactive?: boolean;
}) {
  const cls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1';

  return (
    <div className={`flex items-center ${gap}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(i)}
          className={`transition-colors ${
            interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          } ${i <= value ? 'text-amber-400' : 'text-muted-foreground/30'}`}
        >
          <Star className={`${cls} fill-current`} />
        </button>
      ))}
    </div>
  );
}

function toBnDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const initial = review.name.charAt(0).toUpperCase();
  const colors = [
    'bg-primary/15 text-primary',
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  ];
  const colorClass = colors[index % colors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold ${colorClass}`}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-foreground text-sm truncate">{review.name}</p>
            <span className="shrink-0 text-[10px] sm:text-[11px] text-muted-foreground">{toBnDate(review.createdAt)}</span>
          </div>
          <div className="mt-1">
            <StarRating value={review.rating} size="sm" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {review.comment}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Pagination ── */
function Pagination({
  total,
  currentPage,
  onPageChange,
}: {
  total: number;
  currentPage: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / PER_PAGE);

  if (totalPages <= 1) return null;

  // Build page numbers to show (max 5 visible with ellipsis)
  const pages: (number | '...')[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const toBn = (n: number) => n.toLocaleString('bn-BD');

  return (
    <div className="flex items-center justify-center gap-1.5 pt-6">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-1.5 text-muted-foreground text-sm select-none">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={currentPage === p ? 'default' : 'outline'}
            size="icon"
            className="h-9 w-9 text-sm font-medium"
            onClick={() => onPageChange(p as number)}
          >
            {toBn(p as number)}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ── Review Form ── */
function ReviewForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rating, comment }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error || 'সমস্যা হয়েছে');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('রিভিউ জমা হয়েছে! ধন্যবাদ 🎉');
      setName('');
      setRating(0);
      setComment('');
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const isValid = name.trim() && rating >= 1 && comment.trim().length >= 5;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-6">
      <h3 className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
        <MessageSquarePlus className="h-5 w-5 text-primary" />
        আপনার মতামত দিন
      </h3>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            আপনার নাম <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="আপনার নাম লিখুন"
              className="pl-9"
            />
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            রেটিং <span className="text-destructive">*</span>
          </label>
          <StarRating value={rating} onChange={setRating} interactive />
        </div>

        {/* Comment */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            আপনার মন্তব্য <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="আমাদের সেবা সম্পর্কে আপনার মতামত লিখুন..."
            rows={3}
            className="resize-none"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {comment.length}/৫০০
          </p>
        </div>

        {/* Submit */}
        <Button
          onClick={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending}
          className="w-full gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          রিভিউ জমা দিন
        </Button>
      </div>
    </div>
  );
}

/* ── Main Section ── */
export function ReviewSection() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ['public-reviews'],
    queryFn: async () => {
      const res = await fetch('/api/reviews');
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const avgRating = useMemo(
    () =>
      reviews && reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null,
    [reviews],
  );

  const totalPages = Math.ceil((reviews?.length ?? 0) / PER_PAGE);
  const pagedReviews = useMemo(
    () => reviews?.slice((page - 1) * PER_PAGE, page * PER_PAGE) ?? [],
    [reviews, page],
  );

  // Reset page when new review is added
  const handleReviewSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
    setPage(1);
  };

  // Reset page if reviews shrink below current page
  if (page > totalPages && totalPages > 0) setPage(totalPages);

  return (
    <section className="py-10 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8 sm:mb-10"
        >
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
            আমাদের ব্যবহারকারীদের মতামত
          </h2>
          {avgRating && (
            <div className="mt-2 sm:mt-3 flex items-center justify-center gap-2">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-amber-400 text-amber-400" />
              <span className="text-base sm:text-lg font-bold text-foreground">{avgRating}</span>
              <span className="text-xs sm:text-sm text-muted-foreground">
                ({reviews!.length} টি রিভিউ)
              </span>
            </div>
          )}
        </motion.div>

        {/* Mobile: stacked — Form first, then Reviews */}
        <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 space-y-6 lg:space-y-0">
          {/* Form */}
          <div>
            <div className="lg:sticky lg:top-24">
              <ReviewForm onSuccess={handleReviewSuccess} />
            </div>
          </div>

          {/* Reviews List */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !reviews?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/60">
                <MessageSquarePlus className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground font-medium">এখনো কোনো রিভিউ নেই</p>
                <p className="text-sm text-muted-foreground/60 mt-1">প্রথম রিভিউ দিন!</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <AnimatePresence mode="wait">
                    {pagedReviews.map((review, i) => (
                      <ReviewCard key={review.id} review={review} index={i} />
                    ))}
                  </AnimatePresence>
                </div>

                <Pagination
                  total={reviews.length}
                  currentPage={page}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}