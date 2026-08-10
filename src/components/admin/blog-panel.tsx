'use client';
import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useT } from '@/lib/i18n';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Save,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toBnDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ─── Post Editor Form ─── */
function PostEditor({
  post,
  onSave,
  onCancel,
}: {
  post?: BlogPost;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [content, setContent] = useState(post?.content || '');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [published, setPublished] = useState(post?.published || false);
  const t = useT();

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!post) setSlug(slugify(val));
  };

  const handleSubmit = () => {
    if (!title.trim() || !slug.trim() || !content.trim()) {
      toast.error(t('admin.blog.requiredFields'));
      return;
    }
    onSave({ id: post?.id, title, slug, excerpt, content, coverImage, published });
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('admin.blog.back')}
      </button>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('admin.blog.titleField')} *</Label>
          <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder={t('admin.blog.titlePlaceholder')} />
        </div>

        <div className="space-y-2">
          <Label>{t('admin.blog.slugField')} *</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="post-url-slug" className="font-mono text-sm" />
        </div>

        <div className="space-y-2">
          <Label>{t('admin.blog.coverImageField')}</Label>
          <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t('admin.blog.excerptField')}</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder={t('admin.blog.excerptPlaceholder')} rows={2} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t('admin.blog.contentField')} *</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('admin.blog.contentPlaceholder')}
            rows={14}
            className="min-h-[300px]"
          />
          <p className="text-xs text-muted-foreground">
            {t('admin.blog.htmlHint')}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            onClick={() => setPublished(!published)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${published ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow ${published ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <Label className="cursor-pointer" onClick={() => setPublished(!published)}>
            {published ? t('admin.blog.published') : t('admin.blog.draft')}
          </Label>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSubmit} className="gap-2">
          <Save className="h-4 w-4" />
          {post ? t('admin.blog.update') : t('admin.blog.create')}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t('admin.blog.cancel')}
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Blog Panel ─── */
export function BlogPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>(undefined);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['admin-blog-posts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/blog');
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const isEdit = !!data.id;
      const res = await fetch('/api/admin/blog', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('admin.blog.generalError'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      setEditorOpen(false);
      setEditingPost(undefined);
      toast.success(t('admin.blog.saveSuccess'));
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/admin/blog?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast.success(t('admin.blog.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('admin.blog.deleteError'));
    },
  });

  const handleSave = (data: Record<string, unknown>) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  // Editor View
  if (editorOpen) {
    return (
      <div className="mx-auto max-w-3xl">
        <PostEditor
          post={editingPost}
          onSave={handleSave}
          onCancel={() => {
            setEditorOpen(false);
            setEditingPost(undefined);
          }}
        />
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('admin.blog.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('admin.blog.totalPosts', { total: String(posts?.length || 0), published: String(posts?.filter((p) => p.published).length || 0) })}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPost(undefined);
            setEditorOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('admin.blog.newPost')}
        </Button>
      </div>

      {!posts?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">{t('admin.blog.noPosts')}</p>
          <p className="text-sm text-muted-foreground/60 mt-1">{t('admin.blog.createFirst')}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[65vh] overflow-y-auto">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex items-start gap-4 rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 transition-shadow hover:shadow-md"
            >
              {post.coverImage ? (
                <img
                  src={post.coverImage}
                  alt=""
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover shrink-0"
                  loading="lazy" decoding="async"
                />
              ) : (
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground truncate">{post.title}</h3>
                  <Badge
                    variant={post.published ? 'default' : 'secondary'}
                    className="text-[10px] shrink-0"
                  >
                    {post.published ? t('admin.blog.published') : t('admin.blog.draft')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">/{post.slug}</p>
                <p className="text-xs text-muted-foreground mt-1">{toBnDate(post.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingPost(post);
                    setEditorOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("admin.blog.deleteConfirm")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('admin.blog.deleteDesc')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <Button variant="destructive" onClick={() => deleteMutation.mutate(post.id)}>
                        {t('admin.blog.delete')}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}