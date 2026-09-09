'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Search, X, MessageCircle, Package, Plus, Loader2, User,
  Palette, Code2, PenTool, Megaphone, GraduationCap, Wrench, LayoutGrid, TrendingUp,
  ChevronLeft, ChevronRight, Zap, ArrowRight, Clock, Star, Upload, ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';

interface ProductSeller { id: string; name: string; email?: string; imageLink?: string | null; whatsappNumber?: string | null; }
interface Product {
  id: string; title: string; description: string; price: number; category: string;
  image?: string | null; status: string; createdAt: string; seller: ProductSeller;
}

const CATEGORIES = [
  { key: 'all', bn: '\u09B8\u09AC', en: 'All', Icon: LayoutGrid, color: 'text-primary' },
  { key: 'design', bn: '\u09A1\u09BF\u099C\u09BE\u0987\u09A8', en: 'Design', Icon: Palette, color: 'text-pink-500 dark:text-pink-400' },
  { key: 'development', bn: '\u09A1\u09C7\u09AD\u09C7\u09B2\u09AA\u09AE\u09C7\u09A8\u09CD\u099F', en: 'Development', Icon: Code2, color: 'text-blue-500 dark:text-blue-400' },
  { key: 'content', bn: '\u0995\u09A8\u09CD\u099F\u09C7\u09A8\u09CD\u099F', en: 'Content', Icon: PenTool, color: 'text-orange-500 dark:text-orange-400' },
  { key: 'marketing', bn: '\u09AE\u09BE\u09B0\u09CD\u0995\u09C7\u099F\u09BF\u0982', en: 'Marketing', Icon: Megaphone, color: 'text-purple-500 dark:text-purple-400' },
  { key: 'education', bn: '\u09B6\u09BF\u0995\u09CD\u09B7\u09BE', en: 'Education', Icon: GraduationCap, color: 'text-amber-500 dark:text-amber-400' },
  { key: 'software', bn: '\u09B8\u09AB\u099F\u0993\u09AF\u09BC\u09CD\u09AF\u09BE\u09B0', en: 'Software', Icon: Wrench, color: 'text-cyan-500 dark:text-cyan-400' },
  { key: 'social_media', bn: '\u09B8\u09CB\u09B6\u09B2 \u09AE\u09BF\u09A1\u09BF\u09AF\u09BC\u09BE', en: 'Social Media', Icon: TrendingUp, color: 'text-green-500 dark:text-green-400' },
  { key: 'id', bn: '\u0986\u0987\u09A1\u09BF', en: 'ID', Icon: Star, color: 'text-rose-500 dark:text-rose-400' },
];

const CATEGORY_BG: Record<string, string> = {
  design: 'from-pink-500/10 to-pink-500/5 dark:from-pink-500/15 dark:to-pink-500/5',
  development: 'from-blue-500/10 to-blue-500/5 dark:from-blue-500/15 dark:to-blue-500/5',
  content: 'from-orange-500/10 to-orange-500/5 dark:from-orange-500/15 dark:to-orange-500/5',
  marketing: 'from-purple-500/10 to-purple-500/5 dark:from-purple-500/15 dark:to-purple-500/5',
  education: 'from-amber-500/10 to-amber-500/5 dark:from-amber-500/15 dark:to-amber-500/5',
  software: 'from-cyan-500/10 to-cyan-500/5 dark:from-cyan-500/15 dark:to-cyan-500/5',
  social_media: 'from-green-500/10 to-green-500/5 dark:from-green-500/15 dark:to-green-500/5',
  id: 'from-rose-500/10 to-rose-500/5 dark:from-rose-500/15 dark:to-rose-500/5',
  other: 'from-zinc-500/10 to-zinc-500/5 dark:from-zinc-500/15 dark:to-zinc-500/5',
};

const PROMO_SLIDES = [
  { bn: { title: '\u09AA\u09CD\u09B0\u09A5\u09AE \u09A1\u09BF\u099C\u09BF\u099F\u09BE\u09B2 \u09AA\u09A3\u09CD\u09AF \u0995\u09BF\u09A8\u09C1\u09A8', subtitle: '\u09AE\u09BF\u09A1\u09AE\u09CD\u09AF\u09BE\u09A8 \u098F\u09B8\u0995\u09CD\u09B0\u09CB\u09A4\u09C7 100% \u09B8\u09C1\u09B0\u0995\u09CD\u09B7\u09BF\u09A4 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8', cta: '\u098F\u0996\u09A8\u0987 \u09A6\u09C7\u0996\u09C1\u09A8', icon: Zap }, en: { title: 'Buy Your First Digital Product', subtitle: '100% secure transactions with Midman Escrow', cta: 'Explore Now', icon: Zap } },
  { bn: { title: '\u09AC\u09BF\u0995\u09CD\u09B0\u09C7\u09A4\u09BE \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09A8', subtitle: '\u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09BF\u099C\u09BF\u099F\u09BE\u09B2 \u09B8\u09BE\u09B0\u09CD\u09AD\u09BF\u09B8 \u09AC\u09BF\u0995\u09CD\u09B0\u09BF \u0995\u09B0\u09C1\u09A8 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A6\u09C7', cta: '\u09AA\u09A3\u09CD\u09AF \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8', icon: TrendingUp }, en: { title: 'Join as a Seller', subtitle: 'Sell your digital services safely', cta: 'Add Product', icon: TrendingUp } },
  { bn: { title: '\u09B8\u09B0\u09BE\u09B8\u09B0\u09BF \u09B8\u09C7\u09B2\u09BE\u09B0\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u099A\u09CD\u09AFা\u099F', subtitle: '\u09AA\u09CD\u09B0\u09B6\u09CD\u09A8 \u099C\u09BF\u099C\u09CD\u099E\u09BE\u09B8\u09BE \u0995\u09B0\u09C1\u09A8, \u09A1\u09BF\u09B2 \u09AB\u09BE\u0987\u09A8\u09BE\u09B2 \u0995\u09B0\u09C1\u09A8', cta: '\u09AE\u09BE\u09B0\u09CD\u0995\u09C7\u099F\u09AA\u09CD\u09B2\u09C7\u09B8 \u09A6\u09C7\u0996\u09C1\u09A8', icon: MessageCircle }, en: { title: 'Chat Directly with Sellers', subtitle: 'Ask questions, negotiate, and finalize deals', cta: 'View Marketplace', icon: MessageCircle } },
];

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } }),
};

function formatPrice(price: number, locale: string): string {
  const formatted = price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return locale === 'bn'
    ? '৳' + formatted.replace(/[0-9]/g, (d) => '\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF\u09E7\u09E8\u09E9'[parseInt(d)])
    : '৳' + formatted;
}

function timeAgo(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return locale === 'bn' ? `${Math.max(1, mins)} \u09AE\u09BF\u09A8\u09BF\u099F \u0986\u0997\u09C7` : `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return locale === 'bn' ? `${hrs} \u0998\u09A3\u09CD\u099F\u09BE \u0986\u0997\u09C7` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return locale === 'bn' ? `${days} \u09A6\u09BF\u09A8 \u0986\u0997\u09C7` : `${days}d ago`;
}

function getCategoryIcon(category: string) {
  const cat = CATEGORIES.find(c => c.key === category);
  return cat ? cat.Icon : Package;
}
function getCategoryColor(category: string) {
  const cat = CATEGORIES.find(c => c.key === category);
  return cat?.color || 'text-muted-foreground';
}

// -- PromoSlider --
function PromoSlider({ locale, onExplore }: { locale: string; onExplore: () => void }) {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    intervalRef.current = setInterval(() => setCurrent(p => (p + 1) % PROMO_SLIDES.length), 4500);
    return () => clearInterval(intervalRef.current);
  }, []);
  const slide = PROMO_SLIDES[current];
  const content = slide[locale === 'bn' ? 'bn' : 'en'];
  const SlideIcon = content.icon;
  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/[0.07] via-primary/[0.04] to-transparent dark:from-primary/[0.12] dark:via-primary/[0.06] dark:to-transparent border border-primary/10">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/[0.06] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-primary/[0.04] blur-2xl" />
      <div className="relative flex items-center gap-5 px-5 py-6 sm:px-8 sm:py-8 sm:gap-8">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 shadow-lg shadow-primary/10 sm:h-16 sm:w-16 sm:rounded-3xl">
          <SlideIcon className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground sm:text-xl">{content.title}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground sm:text-sm">{content.subtitle}</p>
          <Button onClick={onExplore} variant="ghost" className="mt-3 h-8 gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-primary hover:bg-primary/10 sm:h-9 sm:px-4 sm:text-[13px]">
            {content.cta} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="hidden sm:flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {PROMO_SLIDES.map((_, i) => (
              <button key={i} onClick={() => { setCurrent(i); clearInterval(intervalRef.current); }} className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-primary' : 'w-2 bg-primary/20 hover:bg-primary/40'}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex sm:hidden justify-center gap-1.5 pb-4">
        {PROMO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => { setCurrent(i); clearInterval(intervalRef.current); }} className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-5 bg-primary' : 'w-1.5 bg-primary/20'}`} />
        ))}
      </div>
    </div>
  );
}

// -- CategoryGrid --
function CategoryGrid({ active, onSelect, locale }: { active: string; onSelect: (k: string) => void; locale: string }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
      {CATEGORIES.map(cat => {
        const isActive = active === cat.key;
        return (
          <button key={cat.key} onClick={() => onSelect(cat.key)} className={`group relative flex flex-col items-center gap-2 rounded-xl p-3 transition-all duration-200 sm:rounded-2xl sm:p-4 ${isActive ? 'bg-primary/10 border-2 border-primary/30 shadow-md shadow-primary/10' : 'bg-card border border-border/30 hover:border-primary/20 hover:shadow-sm dark:border-border/20'}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 transition-colors sm:h-11 sm:w-11 sm:rounded-2xl group-hover:bg-muted ${isActive ? 'bg-primary/15' : ''}`}>
              <cat.Icon className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${isActive ? 'text-primary' : cat.color}`} strokeWidth={1.8} />
            </div>
            <span className={`text-[11px] font-semibold leading-tight sm:text-[12px] ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>{cat[locale === 'bn' ? 'bn' : 'en']}</span>
          </button>
        );
      })}
    </div>
  );
}

// -- ProductCard --
function ProductCard({ product, index, onClick, t, locale }: { product: Product; index: number; onClick: () => void; t: (k: string) => string; locale: string }) {
  const CatIcon = getCategoryIcon(product.category);
  const catColor = getCategoryColor(product.category);
  const gradientBg = CATEGORY_BG[product.category] || CATEGORY_BG.other;
  return (
    <motion.article role="listitem" custom={index} variants={cardVariant} initial="hidden" animate="visible" onClick={onClick} className="group cursor-pointer overflow-hidden rounded-2xl border border-border/30 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-primary/[0.07] hover:border-primary/25 hover:-translate-y-1 dark:border-border/20">
      <div className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${gradientBg}`}>
        {product.image ? (
          <img src={cdnUrl(product.image) || ''} alt={product.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CatIcon className={`h-12 w-12 ${catColor} opacity-30 transition-opacity group-hover:opacity-50 sm:h-14 sm:w-14`} strokeWidth={1.2} />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/10 to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge variant="secondary" className="gap-1.5 bg-background/80 text-[10px] font-semibold backdrop-blur-lg shadow-sm dark:bg-zinc-900/80">
            <CatIcon className={`h-3 w-3 ${catColor}`} strokeWidth={2.5} />
            {CATEGORIES.find(c => c.key === product.category)?.[locale === 'bn' ? 'bn' : 'en'] || product.category}
          </Badge>
        </div>
      </div>
      <div className="p-3.5 sm:p-4">
        <h3 className="line-clamp-1 text-[14px] font-semibold text-foreground transition-colors group-hover:text-primary sm:text-[15px]">{product.title}</h3>
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground sm:text-[13px]">{product.description}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="text-lg font-extrabold text-primary sm:text-xl">{formatPrice(product.price, locale)}</span>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Avatar className="h-4 w-4"><AvatarImage src={cdnUrl(product.seller.imageLink) || undefined} /><AvatarFallback className="text-[7px]"><User className="h-2.5 w-2.5" /></AvatarFallback></Avatar>
              <span className="max-w-[70px] truncate text-[10px] font-medium sm:text-[11px]">{product.seller.name}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground/60">
              <Clock className="h-2.5 w-2.5" />
              <span className="text-[9px] sm:text-[10px]">{timeAgo(product.createdAt, locale)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// -- AddProductDialog --
function ImageUploader({ image, onChange, t, uploading, onUpload }: { image: string; onChange: (v: string) => void; t: (k: string) => string; uploading: boolean; onUpload: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) onUpload(f); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) onUpload(f); };
  if (image && !image.startsWith('data:')) return (
    <div className="relative group">
      <img src={cdnUrl(image) || ''} alt="Product" className="w-full h-40 object-cover rounded-xl border border-border/40" />
      <button type="button" onClick={() => { onChange(''); if (fileRef.current) fileRef.current.value = ''; }} className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
  return (
    <div className="space-y-2">
      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()} className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-primary/30 hover:bg-muted/30'}`}>
        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
        <p className="text-[12px] text-muted-foreground text-center">{uploading ? t('marketplace.uploading') : t('marketplace.dragDrop')}</p>
        <p className="text-[11px] text-muted-foreground/60">{t('marketplace.maxSize')}</p>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFile} className="hidden" />
      </div>
      <p className="text-center text-[11px] text-muted-foreground">{t('marketplace.orUrl')}</p>
      <Input value={image} onChange={e => onChange(e.target.value)} placeholder="https://..." className="text-[12px]" />
    </div>
  );
}

function AddProductDialog({ open, onClose, onCreated, t, locale }: { open: boolean; onClose: () => void; onCreated: (product: Product) => void; t: (k: string) => string; locale: string }) {
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [price, setPrice] = useState(''); const [category, setCategory] = useState('other'); const [image, setImage] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [submitting, setSubmitting] = useState(false); const [uploading, setUploading] = useState(false);
  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      if (image) fd.append('oldImage', image);
      const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Server error' }));
        toast.error(errData.error || `Upload failed (${res.status})`);
        return;
      }
      const data = await res.json();
      if (data.success && data.url) setImage(data.url);
      else toast.error(data.error || 'Upload failed');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !price) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description, price: Number(price), category, image: image.trim() || undefined, quantity: Number(quantity) }) });
      const data = await res.json();
      if (data.success && data.product) { toast.success(t('marketplace.productAdded')); onCreated(data.product); onClose(); setTitle(''); setDescription(''); setPrice(''); setCategory('other'); setImage(''); setQuantity('10'); }
      else toast.error(data.error || t('marketplace.addFailed'));
    } catch { toast.error(t('marketplace.addFailed')); } finally { setSubmitting(false); }
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }} transition={{ duration: 0.3 }} className="fixed inset-x-4 top-[8%] z-50 mx-auto max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl border border-border/40 bg-card p-5 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:p-6 dark:border-border/25">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-foreground">{t('marketplace.addProduct')}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div><label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formTitle')}</label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('marketplace.formTitlePh')} required /></div>
              <div><label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formDesc')}</label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('marketplace.formDescPh')} rows={3} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formPrice')} (&#x09F3;)</label><Input type="number" min="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="500" required /></div>
                <div><label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formCategory')}</label><select value={category} onChange={e => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">{CATEGORIES.filter(c => c.key !== 'all').map(c => (<option key={c.key} value={c.key}>{c[locale === 'bn' ? 'bn' : 'en']}</option>))}</select></div>
                <div><label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formQuantity')}</label><Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="10" required /></div>
              </div>
              <div><label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formImage')} <span className="text-muted-foreground">({t('marketplace.optional')})</span></label><ImageUploader image={image} onChange={setImage} t={t} uploading={uploading} onUpload={handleImageUpload} /></div>
              <Button type="submit" disabled={submitting} className="w-full gap-2 rounded-xl py-5 text-[14px] font-semibold">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('marketplace.submitProduct')}</Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// -- MarketplaceSection --
export function MarketplaceSection() {
  const t = useT(); const locale = useAppStore((s) => s.locale); const user = useAppStore((s) => s.user);
  const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [activeCategory, setActiveCategory] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const fetchProducts = useCallback(async (cat?: string) => {
    setLoading(true);
    try { const params = cat && cat !== 'all' ? `?category=${cat}` : ''; const res = await fetch(`/api/products${params}`); const data = await res.json(); if (data.success) setProducts(data.products || []); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchProducts(activeCategory); }, [activeCategory, fetchProducts]);

  const filtered = products.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()));

  // Navigate to the product order page (replaces the old popup dialog)
  const openProductPage = (id: string) => {
    const store = useAppStore.getState();
    store.setProductDetailId(id);
    store.setView('page-product');
  };

  return (
    <section aria-label={t('page.marketplace.title')} className="space-y-6 sm:space-y-8">
      <PromoSlider locale={locale} onExplore={() => {}} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('marketplace.searchPlaceholder')} aria-label={t('marketplace.searchPlaceholder')} className="h-11 w-full rounded-xl border border-border/40 bg-background pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all dark:border-border/25" />
        </div>
        {user?.isSeller && (
          <Button onClick={() => setShowAddDialog(true)} className="gap-2 rounded-xl text-[13px] font-semibold shadow-md shadow-primary/20"><Plus className="h-4 w-4" /> {t('marketplace.addProduct')}</Button>
        )}
      </div>
      <nav aria-label={locale === 'bn' ? '\u0995\u09CD\u09AF\u09BE\u099F\u09C7\u0997\u09B0\u09BF \u09AB\u09BF\u09B2\u09CD\u099F\u09BE\u09B0' : 'Category filter'}>
        <CategoryGrid active={activeCategory} onSelect={setActiveCategory} locale={locale} />
      </nav>
      <div className="flex items-center gap-2">
        <Package className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
        <h2 className="text-[15px] font-bold text-foreground sm:text-base">{locale === 'bn' ? '\u09B8\u0995\u09B2 \u09AA\u09A3\u09CD\u09AF' : 'All Products'} {!loading && <span className="ml-2 text-[13px] font-normal text-muted-foreground">({filtered.length})</span>}</h2>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border/30 bg-card">
            <div className="aspect-[16/10] bg-muted/50" />
            <div className="space-y-2.5 p-4"><div className="h-4 w-3/4 rounded bg-muted" /><div className="h-3 w-full rounded bg-muted" /><div className="flex justify-between pt-2"><div className="h-5 w-20 rounded bg-muted" /><div className="h-4 w-16 rounded bg-muted" /></div></div>
          </div>
        ))}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Package className="h-7 w-7 text-primary" /></div>
          <p className="mt-4 text-sm font-semibold text-foreground">{t('marketplace.noProducts')}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('marketplace.noProductsDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">{filtered.map((product, i) => (<ProductCard key={product.id} product={product} index={i} onClick={() => openProductPage(product.id)} t={t} locale={locale} />))}</div>
      )}
      {user?.isSeller && <AddProductDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onCreated={(p) => setProducts(prev => [p, ...prev])} t={t} locale={locale} />}
    </section>
  );
}
