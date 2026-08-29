'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
  X,
  Send,
  Package,
  Tag,
  Image as ImageIcon,
  Plus,
  Loader2,
  ChevronDown,
  Star,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';

// ── Types ──
interface ProductSeller {
  name: string;
  imageLink?: string | null;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image?: string | null;
  status: string;
  createdAt: string;
  seller: ProductSeller;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

// ── Category config ──
const CATEGORIES = [
  { key: 'all', bn: 'সব', en: 'All' },
  { key: 'design', bn: 'ডিজাইন', en: 'Design' },
  { key: 'development', bn: 'ডেভেলপমেন্ট', en: 'Development' },
  { key: 'content', bn: 'কন্টেন্ট', en: 'Content' },
  { key: 'marketing', bn: 'মার্কেটিং', en: 'Marketing' },
  { key: 'education', bn: 'শিক্ষা', en: 'Education' },
  { key: 'software', bn: 'সফটওয়্যার', en: 'Software' },
  { key: 'other', bn: 'অন্যান্য', en: 'Other' },
];

const CATEGORY_ICONS: Record<string, string> = {
  design: '🎨',
  development: '💻',
  content: '📝',
  marketing: '📢',
  education: '📚',
  software: '🗜️',
  other: '📦',
};

// ── Animation variants ──
const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

// ── Format price with Bengali numerals ──
function formatPrice(price: number, locale: string): string {
  const formatted = price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (locale === 'bn') {
    return '৳' + formatted.replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  }
  return '৳' + formatted;
}

function timeAgo(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return locale === 'bn' ? 'এইমাত্র' : 'just now';
  if (mins < 60) return locale === 'bn' ? `${mins} মিনিট আগে` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return locale === 'bn' ? `${hrs} ঘণ্টা আগে` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return locale === 'bn' ? `${days} দিন আগে` : `${days}d ago`;
  const months = Math.floor(days / 30);
  return locale === 'bn' ? `${months} মাস আগে` : `${months}mo ago`;
}

// ── Product Card ──
function ProductCard({ product, index, onClick, t, locale }: {
  product: Product; index: number; onClick: () => void; t: (k: string) => string; locale: string;
}) {
  return (
    <motion.div
      custom={index}
      variants={cardVariant}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/[0.06] hover:border-primary/20 hover:-translate-y-0.5 dark:border-border/25 dark:hover:border-primary/15"
    >
      {/* Image area */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted/50 dark:bg-zinc-800/50">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/[0.02] dark:from-primary/10 dark:to-primary/[0.03]">
            <span className="text-4xl">{CATEGORY_ICONS[product.category] || '📦'}</span>
          </div>
        )}
        {/* Category badge */}
        <div className="absolute left-3 top-3">
          <Badge
            variant="secondary"
            className="gap-1 bg-background/80 text-[11px] font-medium backdrop-blur-md dark:bg-zinc-900/80"
          >
            <span className="text-xs">{CATEGORY_ICONS[product.category] || '📦'}</span>
            {CATEGORIES.find(c => c.key === product.category)?.[locale === 'bn' ? 'bn' : 'en'] || product.category}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
          {product.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        {/* Price and seller */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {formatPrice(product.price, locale)}
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarImage src={product.seller.imageLink || undefined} />
              <AvatarFallback className="text-[9px]">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-medium">{product.seller.name}</span>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">{timeAgo(product.createdAt, locale)}</p>
      </div>
    </motion.div>
  );
}

// ── Product Detail Dialog ──
function ProductDetailDialog({ product, open, onClose, onMessageSeller, onOrderMidman, t, locale }: {
  product: Product | null; open: boolean; onClose: () => void; onMessageSeller: () => void; onOrderMidman: () => void; t: (k: string) => string; locale: string;
}) {
  if (!product || !open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 top-[5%] z-50 mx-auto max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border border-border/40 bg-card p-0 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 dark:border-border/25"
          >
            {/* Image */}
            <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl bg-muted/50 dark:bg-zinc-800/50">
              {product.image ? (
                <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/[0.02] dark:from-primary/10 dark:to-primary/[0.03]">
                  <span className="text-6xl">{CATEGORY_ICONS[product.category] || '📦'}</span>
                </div>
              )}
              <button
                onClick={onClose}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-md transition-colors hover:bg-background dark:bg-zinc-900/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-6">
              {/* Category + time */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <span>{CATEGORY_ICONS[product.category] || '📦'}</span>
                  {CATEGORIES.find(c => c.key === product.category)?.[locale === 'bn' ? 'bn' : 'en'] || product.category}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{timeAgo(product.createdAt, locale)}</span>
              </div>

              {/* Title */}
              <h2 className="mt-3 text-xl font-bold text-foreground sm:text-2xl">{product.title}</h2>

              {/* Price */}
              <p className="mt-2 text-2xl font-extrabold text-primary">{formatPrice(product.price, locale)}</p>

              {/* Description */}
              <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {product.description}
              </p>

              {/* Seller info */}
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-border/30 bg-muted/30 p-3 dark:border-border/20 dark:bg-zinc-800/30">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={product.seller.imageLink || undefined} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{product.seller.name}</p>
                  <p className="text-[12px] text-muted-foreground">{t('marketplace.seller')}</p>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-[11px] font-medium">{t('marketplace.verified')}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={onMessageSeller}
                  className="flex-1 gap-2 rounded-xl py-5 text-[14px] font-semibold shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/25"
                >
                  <MessageCircle className="h-4.5 w-4.5" />
                  {t('marketplace.messageSeller')}
                </Button>
                <Button
                  onClick={onOrderMidman}
                  variant="outline"
                  className="flex-1 gap-2 rounded-xl border-primary/30 py-5 text-[14px] font-semibold text-primary transition-all hover:bg-primary/5 hover:border-primary/40"
                >
                  <ShoppingCart className="h-4.5 w-4.5" />
                  {t('marketplace.orderViaMidman')}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Product Chat Dialog ──
function ProductChatDialog({ product, open, onClose, t, locale }: {
  product: Product | null; open: boolean; onClose: () => void; t: (k: string) => string; locale: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = useAppStore((s) => s.user);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch messages when dialog opens
  useEffect(() => {
    if (!open || !product) return;
    setLoading(true);
    fetch(`/api/products/${product.id}/chat`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setMessages(data.messages || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, product?.id]);

  // Auto-scroll on new messages
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!text.trim() || !product || sending || !user) return;
    const msgText = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await fetch(`/api/products/${product.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgText }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages(prev => [...prev, data.message]);
      } else {
        toast.error(data.error || t('marketplace.sendFailed'));
        setText(msgText);
      }
    } catch {
      toast.error(t('marketplace.sendFailed'));
      setText(msgText);
    } finally {
      setSending(false);
    }
  };

  if (!product) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:-translate-x-1/2 dark:border-border/25"
            style={{ height: 'min(480px, 80vh)' }}
          >
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3 dark:border-border/20">
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
              <Avatar className="h-8 w-8">
                <AvatarImage src={product.seller.imageLink || undefined} />
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{product.seller.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{product.title}</p>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-medium">{t('marketplace.online')}</span>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{t('marketplace.noMessages')}</p>
                  <p className="text-[12px] text-muted-foreground">{t('marketplace.noMessagesDesc')}</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                          isMe
                            ? 'rounded-br-md bg-primary text-primary-foreground'
                            : 'rounded-bl-md bg-muted dark:bg-zinc-800'
                        }`}
                      >
                        {!isMe && (
                          <p className="mb-0.5 text-[10px] font-semibold text-primary">{msg.senderName}</p>
                        )}
                        <p className="text-[13px] leading-relaxed">{msg.text}</p>
                        <p className={`mt-1 text-[10px] ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {timeAgo(msg.createdAt, locale)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border/30 p-3 dark:border-border/20">
              {!user ? (
                <p className="text-center text-[13px] text-muted-foreground">{t('marketplace.loginRequired')}</p>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('marketplace.typeMessage')}
                    disabled={sending}
                    className="flex-1 rounded-xl border border-border/40 bg-background px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 disabled:opacity-50 dark:border-border/25 dark:bg-zinc-900/50"
                  />\n                  <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Add Product Dialog ──
function AddProductDialog({ open, onClose, onCreated, t, locale }: {
  open: boolean; onClose: () => void; onCreated: (product: Product) => void; t: (k: string) => string; locale: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('other');
  const [image, setImage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !price) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price: Number(price), category, image: image.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success && data.product) {
        toast.success(t('marketplace.productAdded'));
        onCreated(data.product);
        onClose();
        setTitle(''); setDescription(''); setPrice(''); setCategory('other'); setImage('');
      } else {
        toast.error(data.error || t('marketplace.addFailed'));
      }
    } catch {
      toast.error(t('marketplace.addFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-x-4 top-[8%] z-50 mx-auto max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl border border-border/40 bg-card p-5 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:p-6 dark:border-border/25"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{t('marketplace.addProduct')}</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formTitle')}</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('marketplace.formTitlePh')} required />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formDesc')}</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('marketplace.formDescPh')} rows={3} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formPrice')} (৳)</label>
                  <Input type="number" min="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="500" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formCategory')}</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                      <option key={c.key} value={c.key}>{c[locale === 'bn' ? 'bn' : 'en']}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">{t('marketplace.formImage')} <span className="text-muted-foreground">({t('marketplace.optional')})</span></label>
                <Input value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." />
              </div>
              <Button type="submit" disabled={submitting} className="w-full gap-2 rounded-xl py-5 text-[14px] font-semibold">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('marketplace.submitProduct')}
              </Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main Marketplace Section ──
export function MarketplaceSection() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch products
  const fetchProducts = useCallback(async (cat?: string) => {
    setLoading(true);
    try {
      const params = cat && cat !== 'all' ? `?category=${cat}` : '';
      const res = await fetch(`/api/products${params}`);
      const data = await res.json();
      if (data.success) setProducts(data.products || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(activeCategory); }, [activeCategory, fetchProducts]);

  // Filter by search
  const filtered = products.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
  );

  // Handlers
  const handleOrderMidman = () => {
    if (!user) {
      setView('auth');
      return;
    }
    // Navigate to new-deal with product info
    useAppStore.getState().setDashboardPanel('new-deal');
    useAppStore.getState().setView('dashboard');
    // Store product info for pre-fill
    if (selectedProduct) {
      sessionStorage.setItem('marketplace_deal_title', selectedProduct.title);
      sessionStorage.setItem('marketplace_deal_amount', String(selectedProduct.price));
      sessionStorage.setItem('marketplace_deal_desc', selectedProduct.description);
    }
  };

  const handleProductCreated = (product: Product) => {
    setProducts(prev => [product, ...prev]);
  };

  const handleRequireAuth = (action: () => void) => {
    if (!user) {
      toast.error(t('marketplace.loginRequired'));
      setView('auth');
      return;
    }
    action();
  };

  return (
    <div className="space-y-6">
      {/* Top bar: Search + Add button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('marketplace.searchPlaceholder')}
            className="h-10 w-full rounded-xl border border-border/40 bg-background pl-9 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 dark:border-border/25"
          />
        </div>
        {user?.isSeller && (
          <Button
            onClick={() => setShowAddDialog(true)}
            className="gap-2 rounded-xl text-[13px] font-semibold shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            {t('marketplace.addProduct')}
          </Button>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
              activeCategory === cat.key
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-zinc-800/50'
            }`}
          >
            {cat.key !== 'all' && <span className="mr-1">{CATEGORY_ICONS[cat.key]}</span>}
            {cat[locale === 'bn' ? 'bn' : 'en']}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border/30 bg-card">
              <div className="aspect-[16/10] bg-muted/50" />
              <div className="space-y-2.5 p-4">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="flex justify-between pt-2">
                  <div className="h-5 w-20 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">{t('marketplace.noProducts')}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('marketplace.noProductsDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              index={i}
              onClick={() => setSelectedProduct(product)}
              t={t}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onMessageSeller={() => {
          if (!user) {
            toast.error(t('marketplace.loginRequired'));
            setView('auth');
            return;
          }
          setChatProduct(selectedProduct);
          setSelectedProduct(null);
        }}
        onOrderMidman={() => {
          handleOrderMidman();
          setSelectedProduct(null);
        }}
        t={t}
        locale={locale}
      />

      {/* Chat Dialog */}
      <ProductChatDialog
        product={chatProduct}
        open={!!chatProduct}
        onClose={() => setChatProduct(null)}
        t={t}
        locale={locale}
      />

      {/* Add Product Dialog */}
      {user?.isSeller && (
        <AddProductDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onCreated={handleProductCreated}
          t={t}
          locale={locale}
        />
      )}
    </div>
  );
}
