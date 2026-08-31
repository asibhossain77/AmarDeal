'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useEffect, useSyncExternalStore, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, type DealStatus } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SellerDealTracker } from './seller-deal-tracker';
import { NewDealForm } from '@/components/dashboard/new-deal-form';
import { BackButton } from '@/components/shared/back-button';
import { useT } from '@/lib/i18n';
import {
  Inbox, Clock, TrendingUp, Plus, PackageCheck, Eye,
  UserCircle, Store, Loader2, Image, Pencil, Trash2, ImageIcon, Upload, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cdnUrl } from '@/lib/cdn-url';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const emptySubscribe = () => () => {};

const CATEGORIES = [
  { key: 'design', bn: '\u09A1\u09BF\u099C\u09BE\u0987\u09A8', en: 'Design' },
  { key: 'development', bn: '\u09A1\u09C7\u09AD\u09C7\u09B2\u09AA\u09AE\u09C7\u09A8\u09CD\u099F', en: 'Development' },
  { key: 'content', bn: '\u0995\u09A8\u09CD\u099F\u09C7\u09A8\u09CD\u099F', en: 'Content' },
  { key: 'marketing', bn: '\u09AE\u09BE\u09B0\u09CD\u0995\u09C7\u099F\u09BF\u0982', en: 'Marketing' },
  { key: 'education', bn: '\u09B6\u09BF\u0995\u09CD\u09B7\u09BE', en: 'Education' },
  { key: 'software', bn: '\u09B8\u09AB\u099F\u0993\u09AF\u09BC\u09CD\u09AF\u09BE\u09B0', en: 'Software' },
  { key: 'other', bn: '\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF', en: 'Other' },
];

interface DealRow {
  id: string; title: string; amount: number; status: string; createdAt: string;
  buyer?: { id: string; name: string; email: string; phone: string } | null;
  seller?: { id: string; name: string; email: string; phone: string } | null;
  creator?: { id: string; name: string; email: string } | null;
}

interface SellerProduct {
  id: string; title: string; description: string; price: number; category: string; image: string | null; status: string; createdAt: string;
}

function SolidCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white dark:bg-zinc-900 border border-border/50 p-5 shadow-sm ${className}`}>{children}</div>;
}

function formatTaka(amount: number): string {
  return '\u09F3' + Math.round(amount).toLocaleString('en');
}

/* ================================================
   Panel: Business Profile
   ================================================ */

function BusinessProfilePanel() {
  const t = useT();
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/seller/profile').then(r => r.json()).then(data => {
      if (data.business) setProfile(data.business);
      setProductCount(data.productCount || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('seller.businessProfile')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('seller.businessProfileDesc')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <SolidCard className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                {user?.imageLink ? (
                  <img src={cdnUrl(user.imageLink) || ''} alt={user.name} className="h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <Store className="h-7 w-7 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge className="mt-1 bg-primary/10 text-primary border-0 font-medium">{t('dashboard.sellerBadge')}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{t('seller.businessName')}</p>
                <p className="text-sm font-semibold text-foreground">{profile?.name || '---'}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{t('seller.businessEmail')}</p>
                <p className="text-sm font-semibold text-foreground">{profile?.email || '---'}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{t('seller.businessPhone')}</p>
                <p className="text-sm font-semibold text-foreground">{profile?.phone || '---'}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{t('seller.totalProducts')}</p>
                <p className="text-sm font-semibold text-foreground">{productCount}</p>
              </div>
            </div>
          </SolidCard>

          <SolidCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">{t('seller.profileEditNote')}</p>
          </SolidCard>
        </>
      )}
    </motion.div>
  );
}

/* ================================================
   Panel: Add Product
   ================================================ */

function AddProductPanel() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('other');
  const [image, setImage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      if (image) fd.append('oldImage', image);
      const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success && data.url) setImage(data.url);
      else toast.error(data.error || 'Upload failed');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !price || Number(price) <= 0) {
      toast.error(t('seller.fillAllFields'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), price: Number(price), category, image: image.trim() || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('seller.productAdded'));
        setTitle(''); setDescription(''); setPrice(''); setCategory('other'); setImage('');
      } else {
        toast.error(data.error || t('seller.productAddError'));
      }
    } catch {
      toast.error(t('seller.productAddError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('seller.addProduct')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('seller.addProductDesc')}</p>
        </div>
      </div>

      <SolidCard className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t('seller.productTitle')}</Label>
          <Input placeholder={t('seller.productTitlePh')} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t('seller.productDesc')}</Label>
          <Textarea placeholder={t('seller.productDescPh')} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('seller.productPrice')} (\u09F3)</Label>
            <Input type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} min="1" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('seller.productCategory')}</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {locale === 'en' ? cat.en : cat.bn}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t('seller.productImage')}</Label>
          {image && !image.startsWith('data:') ? (
            <div className="relative group">
              <img src={cdnUrl(image) || ''} alt="Product" className="w-full h-44 object-cover rounded-xl border border-border/40" />
              <button type="button" onClick={() => { setImage(''); if (fileRef.current) fileRef.current.value = ''; }} className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"><Pencil className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleImageUpload(f); }}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 p-6 cursor-pointer hover:border-primary/30 hover:bg-muted/30 transition-colors"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
              <p className="text-[13px] text-muted-foreground">{uploading ? t('marketplace.uploading') : t('marketplace.dragDrop')}</p>
              <p className="text-[11px] text-muted-foreground/60">{t('marketplace.maxSize')}</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} className="hidden" />
            </div>
          )}
          <p className="text-center text-[11px] text-muted-foreground">{t('marketplace.orUrl')}</p>
          <Input placeholder={t('seller.productImagePh')} value={image} onChange={(e) => setImage(e.target.value)} className="text-[13px]" />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2 shadow-lg shadow-primary/25">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? t('seller.adding') : t('seller.addProductBtn')}
          </Button>
        </div>
      </SolidCard>
    </motion.div>
  );
}

/* ================================================
   Panel: My Products (Real)
   ================================================ */

function MyProductsPanel() {
  const t = useT();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const setSellerPanel = useAppStore((s) => s.setSellerPanel);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/seller/my-products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/products/' + deleteId, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('seller.productDeleted'));
        fetchProducts();
      }
    } catch { /* silent */ }
    setDeleteId(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('seller.myProducts')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('seller.myProductsCount', { count: products.length })}</p>
        </div>
        <Button onClick={() => setSellerPanel('add-product')} className="rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 gap-2 sm:self-start">
          <Plus className="h-4 w-4" />
          {t('seller.addProduct')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <SolidCard className="text-center py-12">
          <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">{t('seller.noProducts')}</p>
          <Button variant="outline" onClick={() => setSellerPanel('add-product')} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> {t('seller.addFirstProduct')}
          </Button>
        </SolidCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <SolidCard key={p.id} className="space-y-3 relative group">
              <button
                onClick={() => setDeleteId(p.id)}
                className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {p.image ? (
                <div className="h-32 rounded-xl bg-muted overflow-hidden">
                  <img src={cdnUrl(p.image) || ''} alt={p.title} className="h-32 w-full object-cover" />
                </div>
              ) : (
                <div className="h-32 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm text-foreground truncate">{p.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-primary">{formatTaka(p.price)}</span>
                  <Badge className={p.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0'}>
                    {p.status === 'active' ? t('seller.active') : p.status}
                  </Badge>
                </div>
              </div>
            </SolidCard>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('seller.deleteProductConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('seller.deleteProductDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.marketplace.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('admin.marketplace.deleteBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

/* ================================================
   Panel: Overview (unchanged)
   ================================================ */

function SellerOverviewPanel() {
  const t = useT();
  const user = useAppStore((s) => s.user);
  const overviewAvatarUrl = cdnUrl(user?.imageLink);
  const [overviewAvatarLoaded, setOverviewAvatarLoaded] = useState(false);
  useEffect(() => { setOverviewAvatarLoaded(false); if (!overviewAvatarUrl) return; const img = new Image(); img.onload = () => setOverviewAvatarLoaded(true); img.src = overviewAvatarUrl; }, [overviewAvatarUrl]);
  const setSellerPanel = useAppStore((s) => s.setSellerPanel);
  const [stats, setStats] = useState({ incoming: 0, active: 0, completed: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/seller/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        if (res.ok) {
          const data: DealRow[] = await res.json();
          setStats({
            incoming: data.filter(d => d.status === 'created' || d.status === 'payment_pending').length,
            active: data.filter(d => d.status === 'payment_verified' || d.status === 'in_delivery').length,
            completed: data.filter(d => d.status === 'completed').length,
            totalEarnings: data.filter(d => d.status === 'completed').reduce((sum, d) => sum + d.amount, 0),
          });
        }
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user?.id]);

  const cards = [
    { label: t('seller.incomingDeals'), value: loading ? '...' : stats.incoming.toLocaleString('en'), icon: Inbox, color: 'text-primary', bg: 'bg-primary/10' },
    { label: t('seller.activeDeals'), value: loading ? '...' : stats.active.toLocaleString('en'), icon: Clock, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: t('seller.totalEarnings'), value: loading ? '...' : Math.round(stats.totalEarnings).toLocaleString('en'), icon: TrendingUp, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-5 sm:p-6"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-primary overflow-hidden shadow-sm"
            style={overviewAvatarUrl && overviewAvatarLoaded
              ? { backgroundImage: `url(${overviewAvatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { backgroundColor: 'oklch(0.768 0.189 131 / 0.18)' }
            }
          >
            {!(overviewAvatarUrl && overviewAvatarLoaded) && (user?.name?.charAt(0) || 'S')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary/80 mb-0.5">{t('seller.dashboardSummary')}</p>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
              {t('seller.welcome')}, {user?.name?.split(' ')[0] || t('seller.welcomeSeller')} 👋
            </h1>
          </div>
        </div>
      </motion.div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
              <SolidCard>
                <div className="flex items-center justify-between text-center sm:text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </SolidCard>
            </motion.div>
          );
        })}
      </div>

      <div className="mb-6">
        <button onClick={() => setSellerPanel('add-product')} className="w-full rounded-2xl bg-primary/10 border border-primary/15 p-4 text-left transition-colors hover:bg-primary/15">
          <Plus className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-semibold text-foreground">{t('seller.addProduct')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('seller.addProductShort')}</p>
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
        <SolidCard className="flex flex-col items-center gap-4 text-center">
          <div className="w-full">
            <h3 className="mb-3 text-base font-semibold text-foreground">{t('seller.weeklySummary')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('seller.completedDeals')}</span>
                <span className="text-base font-bold text-emerald-500">{loading ? '...' : stats.completed.toLocaleString('en')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('seller.totalEarnings')}</span>
                <span className="text-base font-bold text-foreground">{formatTaka(stats.totalEarnings)}</span>
              </div>
            </div>
          </div>
        </SolidCard>
      </motion.div>
    </>
  );
}

/* ================================================
   Panel: Active Deals (unchanged)
   ================================================ */

function getStatusBadge(status: string) {
  switch (status) {
    case 'created': return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 font-medium">Created</Badge>;
    case 'payment_pending': return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">Pending</Badge>;
    case 'payment_verified': return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium">Verified</Badge>;
    case 'in_delivery': return <Badge className="bg-primary/15 text-primary dark:bg-primary/20 border-0 font-medium">Delivering</Badge>;
    case 'completed': return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium">Completed</Badge>;
    case 'cancelled': return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400 border-0 font-medium">Cancelled</Badge>;
    case 'disputed': return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">Disputed</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function ActiveDealsPanel() {
  const t = useT();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAppStore((s) => s.user);

  const fetchDeals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/seller/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      if (res.ok) { const data: DealRow[] = await res.json(); setDeals(data); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleOpenDeal = (deal: DealRow) => {
    useAppStore.getState().setActiveDeal({
      id: deal.id, title: deal.title, amount: deal.amount, status: deal.status as DealStatus, createdAt: deal.createdAt,
      buyerId: deal.buyer?.id, sellerId: deal.seller?.id, creatorId: deal.creator?.id,
      buyerName: deal.buyer?.name, sellerName: deal.seller?.name,
    });
    useAppStore.getState().setSellerPanel('deal-detail');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center md:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('seller.activeDealsList')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('seller.allDealsDesc')}</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingAnimation size="lg" /></div>
      ) : deals.length === 0 ? (
        <SolidCard className="text-center py-12">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">{t('seller.noDeals')}</p>
        </SolidCard>
      ) : (
        <SolidCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Buyer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b border-border/30 transition-colors hover:bg-accent/30 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">DL-{deal.id.slice(-5)}</td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap max-w-[140px] truncate">{deal.title}</td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{deal.buyer?.name || '---'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">{formatTaka(deal.amount)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{getStatusBadge(deal.status)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <Button size="sm" onClick={() => handleOpenDeal(deal)} className="h-8 gap-1.5 rounded-lg text-xs font-semibold shadow-md shadow-primary/20">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SolidCard>
      )}
    </motion.div>
  );
}

/* ================================================
   Main Content Router
   ================================================ */

export function SellerMain() {
  const sellerPanel = useAppStore((s) => s.sellerPanel);
  const user = useAppStore((s) => s.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

  if (!mounted) return null;

  // If seller account is disabled by admin, show disabled message
  if (user?.sellerDisabled) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:px-6 lg:py-8">
        <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
          <div className="h-20 w-20 rounded-2xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-5">
            <Store className="h-10 w-10 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">সেলার অ্যাকাউন্ট নিষ্ক্রিয়</h2>
          <p className="text-sm text-muted-foreground mb-1">আপনার সেলার অ্যাকাউন্ট অ্যাডমিন দ্বারা সাময়িকভাবে নিষ্ক্রিয় করা হয়েছে।</p>
          <p className="text-sm text-muted-foreground mb-6">অ্যাকাউন্ট আনলক করতে সাপোর্টে যোগাযোগ করুন।</p>
          <div className="rounded-xl bg-muted/40 border border-border/50 p-4 w-full space-y-2">
            <p className="text-xs font-semibold text-foreground">সাপোর্টে যোগাযোগ করুন:</p>
            <p className="text-xs text-muted-foreground">এই সমস্যার সমাধানের জন্য আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন। আপনার অ্যাকাউন্ট পুনরায় সক্রিয় করা হবে।</p>
          </div>
          <button
            onClick={() => useAppStore.getState().setView('dashboard')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            ড্যাশবোর্ডে ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:px-6 lg:py-8">
      {sellerPanel !== 'overview' && sellerPanel !== 'deal-detail' && sellerPanel !== 'new-deal' && (
        <div className="mb-4"><BackButton /></div>
      )}
      {sellerPanel === 'overview' && <SellerOverviewPanel />}
      {sellerPanel === 'new-deal' && <NewDealForm mode="seller" />}
      {sellerPanel === 'active-deals' && <ActiveDealsPanel />}
      {sellerPanel === 'deal-detail' && <SellerDealTracker />}
      {sellerPanel === 'my-products' && <MyProductsPanel />}
      {sellerPanel === 'add-product' && <AddProductPanel />}
      {sellerPanel === 'business-profile' && <BusinessProfilePanel />}
    </div>
  );
}
