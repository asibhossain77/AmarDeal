'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { sanitizeHtml } from '@/lib/sanitize';

const PER_PAGE = 6;

interface BlogPostPreview {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  createdAt: string;
}

interface BlogPostFull extends BlogPostPreview {
  content: string;
  published: boolean;
}

function toBnDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ─── Pagination ─── */
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

  const toBn = (n: number) => n.toLocaleString('en');

  return (
    <div className="flex items-center justify-center gap-1.5 pt-8">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="আগের পেজ"
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
        aria-label="পরের পেজ"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── Blog Post Detail ─── */
function BlogPostDetail({ post, onBack }: { post: BlogPostFull; onBack: () => void }) {
  const t = useT();
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-3xl"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('blog.allPosts')}
      </button>

      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full rounded-2xl object-cover max-h-80 mb-6"
          loading="lazy" decoding="async"
        />
      )}

      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-3">
        {post.title}
      </h1>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Calendar className="h-4 w-4" />
        {toBnDate(post.createdAt)}
      </div>

      {post.excerpt && (
        <p className="text-lg font-medium text-muted-foreground leading-relaxed mb-6 border-l-4 border-primary pl-4">
          {post.excerpt}
        </p>
      )}

      <div
        className="prose prose-neutral dark:prose-invert max-w-none
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3
          [&_p]:leading-relaxed [&_p]:mb-4
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
          [&_li]:mb-1
          [&_strong]:font-semibold
          [&_a]:text-primary [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
      />
    </motion.article>
  );
}

/* ─── Blog Listing ─── */
function BlogListing({ onSelect }: { onSelect: (post: BlogPostPreview) => void }) {
  const t = useT();
  const [page, setPage] = useState(1);

  const { data: posts, isLoading } = useQuery<BlogPostPreview[]>({
    queryKey: ['public-blog-posts'],
    queryFn: async () => {
      const res = await fetch('/api/blog');
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const totalPages = Math.ceil((posts?.length ?? 0) / PER_PAGE);
  const pagedPosts = useMemo(
    () => posts?.slice((page - 1) * PER_PAGE, page * PER_PAGE) ?? [],
    [posts, page],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  if (!posts?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="h-14 w-14 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-medium text-muted-foreground">{t('blog.noPosts')}</p>
        <p className="text-sm text-muted-foreground/60 mt-1">{t('blog.comingSoon')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">{t('blog.title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
          {t('blog.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {pagedPosts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            onClick={() => onSelect(post)}
            className="group cursor-pointer rounded-2xl border border-border/50 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm hover:shadow-lg transition-all active:scale-[0.98]"
          >
            {post.coverImage ? (
              <div className="h-40 sm:h-44 overflow-hidden">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy" decoding="async"
                />
              </div>
            ) : (
              <div className="h-40 sm:h-44 bg-primary/5 flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-primary/30" />
              </div>
            )}
            <div className="p-4 sm:p-5">
              <h3 className="font-semibold text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors text-sm sm:text-base">
                {post.title}
              </h3>
              {post.excerpt && (
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>
              )}
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {toBnDate(post.createdAt)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Pagination total={posts.length} currentPage={page} onPageChange={setPage} />
    </div>
  );
}

/* ─── Blog View (switches between listing & detail) ─── */
export function BlogView() {
  const t = useT();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: fullPost, isLoading: loadingPost } = useQuery<BlogPostFull>({
    queryKey: ['blog-post', selectedSlug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${selectedSlug}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!selectedSlug,
  });

  if (selectedSlug) {
    if (loadingPost) {
      return (
        <div className="flex items-center justify-center py-20">
          <LoadingAnimation size="lg" />
        </div>
      );
    }
    if (!fullPost) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground mb-4">{t('blog.postNotFound')}</p>
          <Button variant="outline" onClick={() => setSelectedSlug(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
        </div>
      );
    }
    return <BlogPostDetail post={fullPost} onBack={() => setSelectedSlug(null)} />;
  }

  return (
    <div className="px-4 sm:px-6 py-10 sm:py-16">
      <BlogListing onSelect={(post) => setSelectedSlug(post.slug)} />
    </div>
  );
}