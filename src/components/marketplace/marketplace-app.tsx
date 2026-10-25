'use client';

/**
 * MarketplaceApp — the mobile shopping app shell for Midman Marketplace.
 *
 * Covers two views from one shell so the chrome (transparent header + fixed
 * bottom navigation) and the cart badge stay perfectly consistent:
 *   - page="browse"  → /marketplace  (banner, category rail, unified grid)
 *   - page="cart"    → /cart         (cart lines; Cart tab active)
 *   - page="product" → product detail (view 'page-product'): the header
 *     swaps the hamburger for a back-to-marketplace action — same sidebar,
 *     same cart badge, no site navbar, no duplicate header.
 *
 * Layout per spec: no site navbar, no back button, transparent compact header
 * (menu + logo left, cart + badge right) → search row with category filter →
 * promo banner → horizontal categories with সব দেখুন → 2-column product grid →
 * fixed 6-item bottom navigation (Home · Categories · Nilam · Orders · Cart ·
 * Account).
 *
 * Desktop (md+): the bottom nav is replaced by ONE persistent collapsible
 * vertical sidebar pinned to the LEFT viewport edge — icons only when
 * collapsed (default), icons + labels when expanded — carrying the same six
 * destinations (incl. Nilam) plus Become a Seller, Landing Page, Admin Deal
 * and Midman Verify, with a language · theme · dashboard footer mirroring the
 * mobile drawer. The content area spans the full width between the sidebar
 * and the right edge. Mobile keeps the bottom nav; the header hamburger opens
 * a drawer with the same destinations (mobile only — never rendered alongside
 * the desktop sidebar).
 *
 * Reuse policy: data comes from the existing public APIs (/api/products,
 * /api/marketplace/services, /api/marketplace/categories, /api/marketplace/
 * banners); category data and the banner slot are imported from
 * marketplace-section.tsx so the two surfaces can never drift; item detail
 * pages and the whole checkout flow are the existing ones — untouched.
 * Cart state lives exclusively in lib/cart-store.ts (single source of truth).
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import {
  Menu, X, Search, ShoppingCart, Home, LayoutGrid, ClipboardList, UserRound,
  Package, Check, Trash2, LayoutDashboard, LogIn, Sun, Moon, ChevronRight,
  Store, Globe, FilePlus, BadgeCheck, Gavel, ArrowLeft,
  PanelLeftClose, PanelLeftOpen, User,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { SellerApplyButton } from '@/components/dashboard/seller-apply-dialog';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { MidmanLogo } from '@/components/shared/midman-logo';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { cdnUrl } from '@/lib/cdn-url';
import { useCartStore, selectCartCount } from '@/lib/cart-store';
import { calculateOrderTotal, SERVICE_CATEGORY_LABELS } from '@/lib/marketplace-pricing';
import { CATEGORY_META } from '@/components/marketplace/services-store';
import {
  CATEGORIES, CATEGORY_BG, AdBannerSlider, AddProductDialog,
  type Product as ProductType,
} from '@/components/landing/marketplace-section';
import { CartView } from '@/components/marketplace/cart-view';

/* ── Product Details page — lazy chunk, only loaded for view 'page-product' ──
 * The skeleton mirrors the real two-column layout so the swap is seamless. */
const ProductDetailView = dynamic(
  () => import('@/components/marketplace/product-detail').then((m) => ({ default: m.ProductDetailView })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted/60" />
          <div className="space-y-4">
            <div className="h-6 w-40 animate-pulse rounded-full bg-muted/60" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted/60" />
            <div className="h-9 w-32 animate-pulse rounded bg-muted/60" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-muted/60" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted/60" />
          </div>
        </div>
      </div>
    ),
  },
);

/* ── Data types (shapes returned by the existing public APIs) ── */

interface Seller { name: string; imageLink?: string | null; businessVerified?: boolean }
type Product = ProductType & { seller: Seller };

interface Service {
  id: string; name: string; category: string; description: string;
  pricePerThousand: number; minQuantity: number; maxQuantity: number;
  deliveryEstimate: string | null; sortOrder: number;
}

/** Feed item: a normalised wrapper so one grid renders both kinds. */
type FeedItem =
  | { kind: 'product'; id: string; product: Product }
  | { kind: 'service'; id: string; service: Service };

/* ── Small helpers ── */

function formatPrice(price: number): string {
  return '৳' + price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function productPriceLabel(p: Product): string {
  const isMulti = p.productType === 'multi' && (p.optionsCount ?? 0) > 0;
  if (p.isFree) return '';
  if (isMulti && p.minPrice !== undefined && p.maxPrice !== undefined && p.minPrice !== p.maxPrice) {
    return `${formatPrice(p.minPrice)} – ${formatPrice(p.maxPrice)}`;
  }
  return formatPrice(p.price);
}

const emptySubscribe = () => () => {};

/* ── Shared nav destinations ──
 * ONE implementation consumed by both the mobile bottom nav and the desktop
 * sidebar — the two chrome surfaces can never drift apart, and cart/auth
 * state is only ever read from the existing stores. */
interface NavItemData {
  key: string; label: string; Icon: React.ElementType;
  active?: boolean; badge?: number | null;
  onClick?: () => void; href?: string;
}

function useNavActions(page: 'browse' | 'cart' | 'product' | 'checkout', onOpenCategories: () => void) {
  return useMemo(() => ({
    home: () => {
      if (page === 'browse') window.scrollTo({ top: 0, behavior: 'smooth' });
      else useAppStore.getState().setView('page-marketplace');
    },
    categories: () => {
      if (page === 'browse') onOpenCategories();
      else useAppStore.getState().setView('page-marketplace');
    },
    orders: () => {
      const s = useAppStore.getState();
      if (!s.user) { s.setView('auth'); return; }
      s.setDashboardPanel('my-orders');
      s.setView('dashboard');
    },
    cart: () => {
      if (page === 'cart') window.scrollTo({ top: 0, behavior: 'smooth' });
      else useAppStore.getState().setView('page-cart');
    },
    account: () => {
      const s = useAppStore.getState();
      if (!s.user) { s.setView('auth'); return; }
      s.setDashboardPanel('profile');
      s.setView('dashboard');
    },
  }), [page, onOpenCategories]);
}

/* ── Cart icon button (header) — badge hidden when cart is empty ── */
function HeaderCartButton() {
  const t = useT();
  const setView = useAppStore((s) => s.setView);
  const count = useCartStore(selectCartCount);
  return (
    <button
      onClick={() => setView('page-cart')}
      aria-label={`${t('cart.title')}${count > 0 ? ` (${count})` : ''}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent active:scale-95"
    >
      <ShoppingCart className="h-[20px] w-[20px]" strokeWidth={2} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

/* ── Theme toggle (drawer) — mirrors the landing navbar toggle ── */
function DrawerThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {!mounted ? <span className="h-4 w-4" /> : theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

/* ── Category chip — shared by the horizontal rail and the bottom sheet ── */
function CatChip({ Icon, color, label, active, onClick, smm }: {
  Icon: React.ElementType; color: string; label: string; active: boolean; onClick: () => void; smm?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex w-[74px] shrink-0 flex-col items-center gap-1.5 rounded-xl border p-2 transition-all duration-200 active:scale-95 ${
        active
          ? 'border-primary/40 bg-primary/10 shadow-sm shadow-primary/10'
          : 'border-border/40 bg-card hover:border-primary/25 hover:shadow-sm dark:border-border/25'
      }`}
    >
      <span className="relative">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? 'bg-primary/15' : 'bg-muted/60 group-hover:bg-muted'}`}>
          <Icon className={`h-[18px] w-[18px] ${active ? 'text-primary' : color}`} strokeWidth={1.8} />
        </span>
        {smm && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 items-center justify-center rounded-full bg-primary px-1 text-[7px] font-bold leading-none text-primary-foreground">
            SMM
          </span>
        )}
      </span>
      <span className={`line-clamp-1 w-full text-center text-[10px] font-semibold leading-tight ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
        {label}
      </span>
    </button>
  );
}

/* ── Unified feed card ── */
function FeedCard({ item, inCart, onAddToCart, locale }: {
  item: FeedItem; inCart: boolean; onAddToCart: (id: string) => void; locale: string;
}) {
  const t = useT();
  const store = useAppStore.getState;

  if (item.kind === 'service') {
    const s = item.service;
    const { Icon: CatIcon, color: catColor } = CATEGORY_META[s.category] || CATEGORY_META.other;
    const gradientBg = CATEGORY_BG[s.category] || CATEGORY_BG.other;
    const minTotal = calculateOrderTotal(s.pricePerThousand, s.minQuantity);
    const platformLabel = SERVICE_CATEGORY_LABELS[s.category]?.[locale === 'bn' ? 'bn' : 'en'] || s.category;
    const openService = () => {
      const st = store();
      st.setServiceDetailId(s.id);
      st.setView('page-service');
    };
    return (
      <motion.article
        role="listitem"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={openService}
        className="group cursor-pointer overflow-hidden rounded-xl border border-border/30 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06] dark:border-border/20"
      >
        <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br ${gradientBg}`}>
          <CatIcon className={`h-10 w-10 ${catColor} opacity-40 transition-all duration-300 group-hover:scale-105 group-hover:opacity-70`} strokeWidth={1.2} />
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold text-foreground backdrop-blur dark:bg-card/80">
            <CatIcon className={`h-2.5 w-2.5 ${catColor}`} strokeWidth={2.5} />
            <span className="line-clamp-1 max-w-[80px]">{platformLabel}</span>
          </span>
        </div>
        <div className="space-y-1 p-2.5">
          <h3 className="line-clamp-1 text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">{s.name}</h3>
          <div className="flex items-end justify-between gap-1">
            <div className="min-w-0">
              <span className="text-[14px] font-extrabold text-primary">{formatPrice(s.pricePerThousand)}</span>
              <span className="ml-0.5 text-[9px] font-medium text-muted-foreground">/1,000</span>
              <p className="truncate text-[9px] text-muted-foreground/70">
                {locale === 'bn' ? 'শুরু' : 'from'} {formatPrice(minTotal)}
                {s.deliveryEstimate ? ` · ${s.deliveryEstimate}` : ''}
              </p>
            </div>
            <span className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 text-[10px] font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {t('cart.orderNow')}
            </span>
          </div>
        </div>
      </motion.article>
    );
  }

  const p = item.product;
  const cat = CATEGORIES.find((c) => c.key === p.category);
  const CatIcon = cat?.Icon ?? Package;
  const catColor = cat?.color ?? 'text-muted-foreground';
  const gradientBg = CATEGORY_BG[p.category] || CATEGORY_BG.other;
  const priceLabel = productPriceLabel(p);
  const openProduct = () => {
    const st = store();
    st.setProductDetailId(p.id);
    st.setView('page-product');
  };
  return (
    <motion.article
      role="listitem"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={openProduct}
      className="group cursor-pointer overflow-hidden rounded-xl border border-border/30 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06] dark:border-border/20"
    >
      <div className={`relative aspect-[4/3] overflow-hidden ${p.image ? 'bg-white' : `bg-gradient-to-br ${gradientBg}`}`}>
        {p.image ? (
          <img src={cdnUrl(p.image) || ''} alt={p.title} loading="lazy" decoding="async" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CatIcon className={`h-10 w-10 ${catColor} opacity-30 transition-opacity group-hover:opacity-50`} strokeWidth={1.2} />
          </div>
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold text-foreground backdrop-blur dark:bg-card/80">
          <CatIcon className={`h-2.5 w-2.5 ${catColor}`} strokeWidth={2.5} />
          {cat ? cat[locale === 'bn' ? 'bn' : 'en'] : p.category}
        </span>
        {p.hasFile && (
          <span className="absolute right-2 top-2 rounded-md bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground backdrop-blur">
            {t('marketplace.digitalProduct')}
          </span>
        )}
        {/* ── Phase 2: physical item badge + live stock availability ── */}
        {p.itemType === 'physical' && (
          <span className="absolute right-2 top-2 rounded-md bg-blue-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
            {t('seller.itemPhysicalShort')}
          </span>
        )}
        {p.itemType === 'physical' && typeof p.quantity === 'number' && p.quantity <= 0 && (
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-red-600/90 px-1.5 py-0.5 text-center text-[9px] font-bold text-white backdrop-blur">
            {t('seller.outOfStock')}
          </span>
        )}
      </div>
      <div className="space-y-1 p-2.5">
        <h3 className="line-clamp-1 text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">{p.title}</h3>
        {/* ── Phase 2: seller name + verified business badge ── */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <User className="h-2.5 w-2.5 shrink-0" />
          <span className="min-w-0 truncate text-[10px] font-medium">{p.seller.name}</span>
          {p.seller.businessVerified && (
            <span title={t('seller.verifiedBusinessBadge')} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-violet-100 px-1 py-0.5 text-[8px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
              <BadgeCheck className="h-2.5 w-2.5" />
            </span>
          )}
          {p.itemType === 'physical' && typeof p.quantity === 'number' && p.quantity > 0 && (
            <span className="ml-auto shrink-0 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
              {t('marketplace.inStockCount', { count: p.quantity })}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-1">
          <span className={`min-w-0 truncate text-[14px] font-extrabold ${p.isFree ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>
            {p.isFree ? t('marketplace.free') : priceLabel}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCart(p.id); }}
            aria-label={inCart ? t('marketplace.inCart') : t('marketplace.addToCart')}
            title={inCart ? t('marketplace.goToCart') : t('marketplace.addToCart')}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all active:scale-90 ${
              inCart
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
            }`}
          >
            {inCart ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/* ── Category bottom sheet — the full category list (See More / filter icon) ── */
function CategorySheet({ open, onClose, active, onSelect, enabledPlatforms, locale }: {
  open: boolean; onClose: () => void; active: string; onSelect: (key: string) => void;
  enabledPlatforms: string[]; locale: string;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const platformCats = enabledPlatforms.filter((k) => (CATEGORY_META[k] || CATEGORY_META.other) && k !== 'other');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label={t('marketplace.selectCategoryGroup')}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border/40 bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-border/25 sm:inset-x-4"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" aria-hidden />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">{t('marketplace.selectCategoryGroup')}</h3>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* All */}
            <button
              onClick={() => { onSelect('all'); onClose(); }}
              aria-pressed={active === 'all'}
              className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] font-bold transition-all active:scale-[0.98] ${
                active === 'all' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/40 bg-background text-foreground dark:border-border/25'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              {CATEGORIES[0][locale === 'bn' ? 'bn' : 'en']}
            </button>

            {/* Digital product categories */}
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
              {t('marketplace.digitalProducts')}
            </p>
            <div className="mb-5 grid grid-cols-4 gap-2">
              {CATEGORIES.slice(1).map((cat) => (
                <CatChip
                  key={cat.key} Icon={cat.Icon} color={cat.color}
                  label={cat[locale === 'bn' ? 'bn' : 'en']}
                  active={active === cat.key}
                  onClick={() => { onSelect(cat.key); onClose(); }}
                />
              ))}
            </div>

            {/* SMM service platforms */}
            {platformCats.length > 0 && (
              <>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
                  {t('marketplace.smmServices')}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {platformCats.map((key) => {
                    const meta = CATEGORY_META[key] || CATEGORY_META.other;
                    return (
                      <CatChip
                        key={`smm:${key}`} Icon={meta.Icon} color={meta.color} smm
                        label={SERVICE_CATEGORY_LABELS[key]?.[locale === 'bn' ? 'bn' : 'en'] || key}
                        active={active === `smm:${key}`}
                        onClick={() => { onSelect(`smm:${key}`); onClose(); }}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Fixed bottom navigation — Home · Categories · Nilam · Orders · Cart · Account ──
 * Mobile only (<md). On desktop the persistent sidebar takes over. */
function BottomNav({ page, onOpenCategories }: { page: 'browse' | 'cart' | 'product' | 'checkout'; onOpenCategories: () => void }) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const count = useCartStore(selectCartCount);
  const nav = useNavActions(page, onOpenCategories);
  const go = useCallback((fn: () => void) => {
    useAppStore.getState().setSidebarOpen(false);
    fn();
  }, []);

  const items: NavItemData[] = [
    {
      key: 'home', label: locale === 'bn' ? 'হোম' : 'Home', Icon: Home,
      active: page === 'browse', onClick: () => go(nav.home),
    },
    {
      key: 'categories', label: t('marketplace.categories'), Icon: LayoutGrid,
      active: false, onClick: () => go(nav.categories),
    },
    {
      key: 'auction', label: t('nav.auction'), Icon: Gavel,
      active: false, onClick: () => go(() => useAppStore.getState().setView('page-auction')),
    },
    {
      key: 'orders', label: t('nav.orders'), Icon: ClipboardList,
      active: false, onClick: () => go(nav.orders),
    },
    {
      key: 'cart', label: t('cart.title'), Icon: ShoppingCart,
      active: page === 'cart', badge: count > 0 ? count : null,
      onClick: () => go(nav.cart),
    },
    {
      key: 'account', label: t('nav.account'), Icon: UserRound,
      active: false, onClick: () => go(nav.account),
    },
  ];

  return (
    <nav
      aria-label={locale === 'bn' ? 'নিচের নেভিগেশন' : 'Bottom navigation'}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-md md:hidden dark:border-border/30"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {items.map(({ key, label, Icon, active, badge, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-w-[52px] flex-1 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="relative">
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
              {badge != null && (
                <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold leading-none text-primary-foreground">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold leading-none">{label}</span>
            {active && <span className="absolute -top-[7px] h-0.5 w-8 rounded-full bg-primary" aria-hidden />}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ── Desktop sidebar (md+) — ONE persistent collapsible navigation, left edge ──
 * Collapsed (default): 56px, icons only, Radix tooltips on hover/focus.
 * Expanded: 240px, icons + labels. The same six destinations as the mobile
 * bottom nav (incl. Nilam) plus the platform actions — no informational site
 * links here. The footer mirrors the mobile drawer: language, theme and the
 * dashboard / login shortcut. The header carries no duplicate navigation on
 * desktop (hamburger is hidden at md+; mobile opens the drawer instead). */
function SidebarItem({ label, Icon, active, badge, expanded, onClick, href }: {
  label: string; Icon: React.ElementType; active?: boolean; badge?: number | null;
  expanded: boolean; onClick?: () => void; href?: string;
}) {
  const shell = `group relative flex h-10 shrink-0 items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
    expanded ? 'w-full gap-2 px-2' : 'w-10 justify-center'
  } ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`;
  const inner = (
    <>
      {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden />}
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.9} />
        {badge != null && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {expanded && <span className="truncate text-[13px] font-semibold">{label}</span>}
    </>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={shell}>{inner}</a>
        ) : (
          <button type="button" onClick={onClick} aria-label={label} aria-current={active ? 'page' : undefined} className={shell}>{inner}</button>
        )}
      </TooltipTrigger>
      {!expanded && <TooltipContent side="right" sideOffset={10} className="font-medium">{label}</TooltipContent>}
    </Tooltip>
  );
}

/* ── Sidebar language button — same bn/en dropdown as the shared
 * LanguageSwitcher, but container-aware: icon-only + tooltip while the
 * sidebar is collapsed, icon + current language label when expanded. ── */
function SidebarLangButton({ expanded }: { expanded: boolean }) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const current = locale === 'bn' ? t('lang.bn') : t('lang.en');
  const shell = `flex h-10 shrink-0 items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
    expanded ? 'w-full gap-2 px-2' : 'w-10 justify-center'
  }`;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={expanded ? current : locale === 'bn' ? 'ভাষা' : 'Language'} className={shell}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                <Globe className="h-5 w-5" strokeWidth={1.9} />
              </span>
              {expanded && <span className="truncate text-[13px] font-semibold">{current}</span>}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {!expanded && <TooltipContent side="right" sideOffset={10} className="font-medium">{current}</TooltipContent>}
      </Tooltip>
      <DropdownMenuContent side="right" align="start" className="w-36">
        <DropdownMenuItem onClick={() => setLocale('bn')} className={locale === 'bn' ? 'bg-primary/10 text-primary font-semibold' : ''}>
          <span className="mr-2.5 text-base">🇧🇩</span>
          {t('lang.bn')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('en')} className={locale === 'en' ? 'bg-primary/10 text-primary font-semibold' : ''}>
          <span className="mr-2.5 text-base">🇬🇧</span>
          {t('lang.en')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DesktopSidebar({ page, expanded, onToggle, onOpenCategories, onBecomeSeller, onAddProduct, isSeller }: {
  page: 'browse' | 'cart' | 'product' | 'checkout'; expanded: boolean; onToggle: () => void;
  onOpenCategories: () => void; onBecomeSeller: () => void; onAddProduct: () => void; isSeller: boolean;
}) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const count = useCartStore(selectCartCount);
  const nav = useNavActions(page, onOpenCategories);
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const mainItems: NavItemData[] = [
    { key: 'home', label: locale === 'bn' ? 'হোম' : 'Home', Icon: Home, active: page === 'browse', onClick: nav.home },
    { key: 'categories', label: t('marketplace.categories'), Icon: LayoutGrid, onClick: nav.categories },
    { key: 'auction', label: t('nav.auction'), Icon: Gavel, onClick: () => useAppStore.getState().setView('page-auction') },
    { key: 'orders', label: t('nav.orders'), Icon: ClipboardList, onClick: nav.orders },
    { key: 'cart', label: t('cart.title'), Icon: ShoppingCart, active: page === 'cart', badge: count > 0 ? count : null, onClick: nav.cart },
    { key: 'account', label: t('nav.account'), Icon: UserRound, onClick: nav.account },
  ];

  /* Platform actions — existing destinations only, nothing informational */
  const platformItems: NavItemData[] = [
    { key: 'seller', label: t('nav.becomeSeller'), Icon: Store, onClick: onBecomeSeller },
    { key: 'landing', label: t('nav.landingPage'), Icon: Globe, onClick: () => useAppStore.getState().setView('landing') },
    {
      key: 'admin-deal', label: t('nav.newDeal'), Icon: FilePlus,
      onClick: () => {
        const s = useAppStore.getState();
        if (!s.user) { s.setView('auth'); return; }
        s.setView('dashboard');
        s.setDashboardPanel('new-deal');
      },
    },
    { key: 'verify', label: t('nav.midmanVerify'), Icon: BadgeCheck, href: 'https://verify.midman.bd' },
  ];

  /* Seller-only quick action — mirrors the mobile drawer's "পণ্য যোগ করুন"
     entry so sellers get the same shortcut on desktop (same dialog). */
  if (isSeller) {
    platformItems.push({
      key: 'add-product', label: t('marketplace.addProduct'), Icon: Package,
      onClick: onAddProduct,
    });
  }

  const toggleLabel = expanded ? t('nav.collapseSidebar') : t('nav.expandSidebar');

  return (
    <aside
      aria-label={locale === 'bn' ? 'মার্কেটপ্লেস নেভিগেশন' : 'Marketplace navigation'}
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto overflow-x-hidden border-r border-border/50 bg-background/95 backdrop-blur-md transition-[width] duration-300 ease-in-out md:flex dark:border-border/30 ${
        expanded ? 'w-60' : 'w-14'
      }`}
    >
      <div className="flex flex-col gap-1 p-2">
        {/* Expand / collapse control (tooltip mirrors SidebarItem in collapsed state) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={toggleLabel}
              className={`group relative flex h-10 shrink-0 items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                expanded ? 'w-full gap-2 px-2' : 'w-10 justify-center'
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                {expanded ? <PanelLeftClose className="h-5 w-5" strokeWidth={1.9} /> : <PanelLeftOpen className="h-5 w-5" strokeWidth={1.9} />}
              </span>
              {expanded && <span className="truncate text-[13px] font-semibold">{toggleLabel}</span>}
            </button>
          </TooltipTrigger>
          {!expanded && <TooltipContent side="right" sideOffset={10} className="font-medium">{toggleLabel}</TooltipContent>}
        </Tooltip>

        {/* Main marketplace destinations — mirror the mobile bottom nav */}
        <nav aria-label={locale === 'bn' ? 'মার্কেটপ্লেস' : 'Marketplace'} className="flex flex-col gap-1">
          {mainItems.map(({ key, ...item }) => (
            <SidebarItem key={key} {...item} expanded={expanded} />
          ))}
        </nav>

        <div className="my-1 h-px shrink-0 bg-border/60" aria-hidden />

        {/* Platform navigation */}
        {expanded && (
          <p className="px-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            {t('marketplace.navPlatform')}
          </p>
        )}
        <nav aria-label={locale === 'bn' ? 'প্ল্যাটফর্ম' : 'Platform'} className="flex flex-col gap-1">
          {platformItems.map(({ key, ...item }) => (
            <SidebarItem key={key} {...item} expanded={expanded} />
          ))}
        </nav>
      </div>

      {/* Footer — language · theme · dashboard, mirroring the mobile drawer footer */}
      <div className="mt-auto shrink-0 border-t border-border/60 p-2 dark:border-border/30">
        <div className="flex flex-col gap-1">
          <SidebarLangButton expanded={expanded} />
          <SidebarItem
            label={t('settings.theme')}
            Icon={mounted ? (theme === 'dark' ? Sun : Moon) : Moon}
            expanded={expanded}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
          {user ? (
            <SidebarItem
              label={t('nav.dashboard')}
              Icon={LayoutDashboard}
              expanded={expanded}
              onClick={() => useAppStore.getState().navigateToDashboard()}
            />
          ) : (
            <SidebarItem
              label={t('nav.loginRegister')}
              Icon={LogIn}
              expanded={expanded}
              onClick={() => useAppStore.getState().setView('auth')}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

/* ── Mobile hamburger drawer (<md) — the mobile counterpart of the desktop ──
 * sidebar: the SAME destinations with icons + text labels (never rendered
 * alongside the desktop sidebar — the trigger is hidden at md+ and the drawer
 * force-closes if the viewport crosses the breakpoint while open).
 * Marketplace-scoped: only real destinations (no Contact / How-to / FAQ /
 * Fees / Security / Blog informational links inside the Marketplace UI).
 * Radix Sheet provides the close button, backdrop click, Escape key and
 * background scroll lock out of the box. */
function MenuDrawer({ open, onOpenChange, page, onOpenCategories, onBecomeSeller, onAddProduct, isSeller }: {
  open: boolean; onOpenChange: (v: boolean) => void; page: 'browse' | 'cart' | 'product' | 'checkout';
  onOpenCategories: () => void; onBecomeSeller: () => void; onAddProduct: () => void; isSeller: boolean;
}) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const navigateToDashboard = useAppStore((s) => s.navigateToDashboard);
  const setView = useAppStore((s) => s.setView);
  const count = useCartStore(selectCartCount);
  const nav = useNavActions(page, onOpenCategories);

  /* Close the drawer first, then run the shared nav action */
  const go = (fn: () => void) => () => { onOpenChange(false); fn(); };

  /* Same six destinations as the bottom nav / desktop sidebar */
  const mainItems: NavItemData[] = [
    { key: 'home', label: locale === 'bn' ? 'হোম' : 'Home', Icon: Home, active: page === 'browse', onClick: go(nav.home) },
    { key: 'categories', label: t('marketplace.categories'), Icon: LayoutGrid, onClick: go(nav.categories) },
    { key: 'auction', label: t('nav.auction'), Icon: Gavel, onClick: go(() => useAppStore.getState().setView('page-auction')) },
    { key: 'orders', label: t('nav.orders'), Icon: ClipboardList, onClick: go(nav.orders) },
    { key: 'cart', label: t('cart.title'), Icon: ShoppingCart, active: page === 'cart', badge: count > 0 ? count : null, onClick: go(nav.cart) },
    { key: 'account', label: t('nav.account'), Icon: UserRound, onClick: go(nav.account) },
  ];

  /* Platform actions — existing destinations only, mirrors the desktop sidebar */
  const platformItems: NavItemData[] = [
    { key: 'seller', label: t('nav.becomeSeller'), Icon: Store, onClick: go(onBecomeSeller) },
    { key: 'landing', label: t('nav.landingPage'), Icon: Globe, onClick: go(() => useAppStore.getState().setView('landing')) },
    {
      key: 'admin-deal', label: t('nav.newDeal'), Icon: FilePlus,
      onClick: go(() => {
        const s = useAppStore.getState();
        if (!s.user) { s.setView('auth'); return; }
        s.setView('dashboard');
        s.setDashboardPanel('new-deal');
      }),
    },
    { key: 'verify', label: t('nav.midmanVerify'), Icon: BadgeCheck, href: 'https://verify.midman.bd' },
  ];

  const rowClass = (active?: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
      active
        ? 'bg-primary/10 font-semibold text-primary'
        : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
    }`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <SheetTitle className="sr-only">{t('nav.openMenu')}</SheetTitle>
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3.5 dark:border-border/25">
          <MidmanLogo className="h-8 rounded-lg" />
        </div>
        <nav aria-label={locale === 'bn' ? 'মার্কেটপ্লেস' : 'Marketplace'} className="flex flex-col gap-0.5 p-3">
          {mainItems.map(({ key, label, Icon, active, badge, onClick, href }) =>
            href ? (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" onClick={() => onOpenChange(false)} className={rowClass(active)}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            ) : (
              <button key={key} onClick={onClick} aria-current={active ? 'page' : undefined} className={rowClass(active)}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {badge != null && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            ),
          )}
        </nav>

        <nav aria-label={locale === 'bn' ? 'প্ল্যাটফর্ম' : 'Platform'} className="flex flex-col gap-0.5 border-t border-border/40 px-3 py-3 dark:border-border/25">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            {t('marketplace.navPlatform')}
          </p>
          {platformItems.map(({ key, label, Icon, onClick, href }) =>
            href ? (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" onClick={() => onOpenChange(false)} className={rowClass()}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            ) : (
              <button key={key} onClick={onClick} className={rowClass()}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ),
          )}
          {isSeller && (
            <button
              onClick={() => { onOpenChange(false); onAddProduct(); }}
              className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <Package className="h-4 w-4" />
              {t('marketplace.addProduct')}
            </button>
          )}
        </nav>
        <div className="mt-auto border-t border-border/40 p-4 dark:border-border/25">
          <div className="mb-3 flex items-center justify-between">
            <LanguageSwitcher />
            <DrawerThemeToggle />
            <span className="text-[11px] text-muted-foreground">{locale === 'bn' ? 'থিম ও ভাষা' : 'Theme & language'}</span>
          </div>
          {user ? (
            <button
              onClick={() => { onOpenChange(false); navigateToDashboard(); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <LayoutDashboard className="h-4 w-4" />
              {t('nav.dashboard')}
            </button>
          ) : (
            <button
              onClick={() => { onOpenChange(false); setView('auth'); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" />
              {t('nav.loginRegister')}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── MarketplaceApp — the shell itself ── */
/* ── Phase 4: Direct checkout — lazy chunk, only loaded for 'page-checkout' ── */
const CheckoutView = dynamic(
  () => import('@/components/marketplace/checkout').then((m) => ({ default: m.CheckoutView })),
  { ssr: false, loading: () => (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted/60" />
      </div>
    </div>
  ) }
);

export function MarketplaceApp({ page }: { page: 'browse' | 'cart' | 'product' | 'checkout' }) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);

  /* Mobile hamburger drawer — mobile only. If the viewport crosses into md+
     while it is open (rotation, window resize), close it so the desktop
     sidebar is the only visible navigation and none overlap. */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setMenuOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Desktop sidebar — collapsed (icons only) by default, choice remembered.
     Mobile never renders it, so this state is inert below md. */
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem('midman-marketplace-sidebar') === '1') setSidebarExpanded(true); } catch { /* private mode */ }
  }, []);
  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((v) => {
      const next = !v;
      try { localStorage.setItem('midman-marketplace-sidebar', next ? '1' : '0'); } catch { /* private mode */ }
      return next;
    });
  }, []);

  /* Become a Seller — guests go to login; sellers go to their dashboard;
     logged-in buyers open the EXISTING WhatsApp application dialog. */
  const [sellerApplyOpen, setSellerApplyOpen] = useState(false);
  const handleBecomeSeller = useCallback(() => {
    const s = useAppStore.getState();
    if (!s.user) { s.setView('auth'); return; }
    if (s.user.isSeller) { s.setDashboardPanel('seller-orders'); s.setView('dashboard'); return; }
    setSellerApplyOpen(true);
  }, []);

  /* Product page header back action — same smart back as the detail page:
     return to the seller profile when that is where the user came from. */
  const handleHeaderBack = useCallback(() => {
    const s = useAppStore.getState();
    // Checkout back → the product the buyer came from
    if (s.view === 'page-checkout') {
      if (s.checkoutDraft?.productId) {
        s.setProductDetailId(s.checkoutDraft.productId);
        s.setView('page-product');
      } else {
        s.setView('page-marketplace');
      }
      return;
    }
    if (s._prevView === 'page-seller-profile') s.goBack();
    else s.setView('page-marketplace');
  }, []);

  /* Deep link: /marketplace?category=<key> preselects a category once on mount */
  useEffect(() => {
    if (page !== 'browse') return;
    const q = new URLSearchParams(window.location.search).get('category');
    if (q && (q === 'all' || CATEGORIES.some((c) => c.key === q))) {
      const s = useAppStore.getState();
      if (s.view === 'page-marketplace') setActiveCategory(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Fetch products + services + admin-enabled SMM platforms (public APIs, unchanged) */
  useEffect(() => {
    if (page !== 'browse') return;
    let alive = true;
    (async () => {
      try {
        const [pRes, sRes, cRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/marketplace/services'),
          fetch('/api/marketplace/categories'),
        ]);
        const pData = await pRes.json().catch(() => null);
        const sData = await sRes.json().catch(() => null);
        const cData = await cRes.json().catch(() => null);
        if (!alive) return;
        setProducts(pData?.success ? pData.products || [] : []);
        setServices(sData?.success ? sData.services || [] : []);
        setEnabledPlatforms(
          cData?.success && Array.isArray(cData.categories) ? cData.categories : [],
        );
      } catch {
        if (alive) { setProducts([]); setServices([]); }
      }
    })();
    return () => { alive = false; };
  }, [page]);

  /* Cart add/remove — the single cart store keeps every badge in sync */
  const cartCount = useCartStore(selectCartCount);
  const cartHas = useCartStore((s) => s.has);
  const handleAddToCart = useCallback((productId: string) => {
    const store = useCartStore.getState();
    if (store.has(productId)) {
      useAppStore.getState().setView('page-cart');
      return;
    }
    const added = store.addItem(productId);
    if (added) toast.success(t('marketplace.addedToCart'));
  }, [t]);

  /* Unified feed: services (admin store, by sortOrder) then products (newest first) */
  const loading = products === null || services === null;
  const feed = useMemo<FeedItem[]>(() => {
    if (products === null || services === null) return [];
    const q = search.trim().toLowerCase();
    const match = (s: string, d: string) => !q || s.toLowerCase().includes(q) || d.toLowerCase().includes(q);
    const isSmmFilter = activeCategory.startsWith('smm:');
    const platform = isSmmFilter ? activeCategory.slice(4) : null;

    /* Filtering semantics: an SMM platform filter shows that platform's
       services; a digital-product category shows only products of that
       category (services excluded); "all" shows the unified feed. */
    const serviceItems: FeedItem[] = platform
      ? services
          .filter((s) => s.category === platform && match(s.name, s.description))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({ kind: 'service' as const, id: s.id, service: s }))
      : activeCategory === 'all'
        ? services
            .filter((s) => match(s.name, s.description))
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((s) => ({ kind: 'service' as const, id: s.id, service: s }))
        : [];

    const productItems: FeedItem[] = platform
      ? []
      : products
          .filter((p) => (activeCategory === 'all' || p.category === activeCategory) && match(p.title, p.description))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((p) => ({ kind: 'product' as const, id: p.id, product: p }));

    return [...serviceItems, ...productItems];
  }, [products, services, search, activeCategory]);

  /* Rail categories: সব + product categories + admin-enabled SMM platforms */
  const railCats = useMemo(() => {
    const platformCats = enabledPlatforms
      .filter((k) => k !== 'other')
      .map((k) => ({
        key: `smm:${k}`,
        Icon: (CATEGORY_META[k] || CATEGORY_META.other).Icon,
        color: (CATEGORY_META[k] || CATEGORY_META.other).color,
        bn: SERVICE_CATEGORY_LABELS[k]?.bn || k,
        en: SERVICE_CATEGORY_LABELS[k]?.en || k,
        smm: true as const,
      }));
    return [
      { key: 'all', Icon: CATEGORIES[0].Icon, color: CATEGORIES[0].color, bn: CATEGORIES[0].bn, en: CATEGORIES[0].en, smm: false as const },
      ...CATEGORIES.slice(1).map((c) => ({ key: c.key, Icon: c.Icon, color: c.color, bn: c.bn, en: c.en, smm: false as const })),
      ...platformCats,
    ];
  }, [enabledPlatforms]);

  const activeLabel = useMemo(() => {
    if (activeCategory === 'all') return null;
    const rail = railCats.find((c) => c.key === activeCategory);
    return rail ? rail[locale === 'bn' ? 'bn' : 'en'] : null;
  }, [activeCategory, railCats, locale]);

  const fetchProductsAfterAdd = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) setProducts(data.products || []);
    } catch { /* keep previous */ }
  }, []);

  return (
    <>
      {/* ── Desktop sidebar (md+): persistent, collapsible, icons-only default ── */}
      <DesktopSidebar
        page={page}
        expanded={sidebarExpanded}
        onToggle={toggleSidebar}
        onOpenCategories={() => setCatSheetOpen(true)}
        onBecomeSeller={handleBecomeSeller}
        onAddProduct={() => setAddProductOpen(true)}
        isSeller={!!user?.isSeller}
      />

      <div
        className={`flex min-h-screen flex-col transition-[padding-left] duration-300 ease-in-out ${
          sidebarExpanded ? 'md:pl-60' : 'md:pl-14'
        }`}
      >
      {/* ── Compact transparent header ──
          browse/cart: logo left · cart right; mobile adds the hamburger
          (drawer trigger, hidden at md+ so the desktop header carries no
          duplicate navigation).
          product: the hamburger is replaced by a back-to-marketplace action
          on BOTH breakpoints — no drawer, no duplicate navigation. */}
      <header className="flex w-full items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5">
          {page === 'product' || page === 'checkout' ? (
            <button
              type="button"
              onClick={handleHeaderBack}
              aria-label={t('sellerProfile.backToMarketplace')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : (
            <div className="md:hidden">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    aria-label={t('nav.openMenu')}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent active:scale-95"
                  >
                    <Menu className="h-5 w-5" strokeWidth={2} />
                  </button>
                </SheetTrigger>
                <MenuDrawer
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  page={page}
                  onOpenCategories={() => setCatSheetOpen(true)}
                  onBecomeSeller={handleBecomeSeller}
                  onAddProduct={() => setAddProductOpen(true)}
                  isSeller={!!user?.isSeller}
                />
              </Sheet>
            </div>
          )}
          <button onClick={() => useAppStore.getState().setView('landing')} aria-label="Midman" className="flex items-center rounded-lg">
            <MidmanLogo className="h-8 rounded-lg" priority />
          </button>
        </div>
        <HeaderCartButton />
      </header>

      {page === 'product' ? (
        <ProductDetailView />
      ) : page === 'checkout' ? (
        <CheckoutView />
      ) : page === 'cart' ? (
        <CartView />
      ) : (
        <main className="w-full flex-1 px-4 pb-28 sm:px-6 sm:pb-32 md:pb-10 lg:px-8">
          {/* Full width between the left sidebar and the right edge — no narrow
              centered column. Extra grid columns on wide screens keep the cards
              at a sensible size instead of stretching them. */}
          {/* ── Search + category filter ── */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCatSheetOpen(true)}
              aria-haspopup="dialog"
              aria-label={t('marketplace.categories')}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                activeCategory !== 'all'
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/40 bg-card text-foreground hover:border-primary/25 dark:border-border/25'
              }`}
            >
              <LayoutGrid className="h-5 w-5" strokeWidth={2} />
            </button>
            <div className="group relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('marketplace.searchAnything')}
                aria-label={t('marketplace.searchAnything')}
                className="h-11 w-full rounded-xl border border-border/40 bg-card pl-10 pr-9 text-[13px] font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all dark:border-border/25"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Promotional banner (admin-managed; promo slider fallback) ── */}
          <div className="mt-3.5">
            <AdBannerSlider locale={locale} onExplore={() => {}} />
          </div>

          {/* ── Categories: horizontal rail + সব দেখুন ── */}
          <div className="mt-5 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
              <LayoutGrid className="h-4 w-4 text-primary" strokeWidth={2.2} />
              {t('marketplace.categories')}
              {activeLabel && (
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{activeLabel}</span>
              )}
            </h2>
            <button
              onClick={() => setCatSheetOpen(true)}
              className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[12px] font-bold text-primary transition-colors hover:bg-primary/10"
            >
              {t('marketplace.seeAll')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" role="list" aria-label={t('marketplace.categories')}>
            {railCats.map((cat) => (
              <CatChip
                key={cat.key}
                Icon={cat.Icon}
                color={cat.color}
                label={cat[locale === 'bn' ? 'bn' : 'en']}
                smm={cat.smm}
                active={activeCategory === cat.key}
                onClick={() => setActiveCategory(cat.key)}
              />
            ))}
          </div>

          {/* ── Unified products & services grid ── */}
          <div className="mt-5 flex items-center gap-1.5">
            <Package className="h-4 w-4 text-primary" strokeWidth={2.2} />
            <h2 className="text-[15px] font-bold text-foreground">
              {t('marketplace.allProductsServices')}
              {!loading && <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">({feed.length})</span>}
            </h2>
          </div>

          {loading ? (
            <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-border/30 bg-card dark:border-border/20">
                  <div className="aspect-[4/3] bg-muted/50" />
                  <div className="space-y-2 p-2.5">
                    <div className="h-3.5 w-3/4 rounded bg-muted" />
                    <div className="flex justify-between">
                      <div className="h-4 w-16 rounded bg-muted" />
                      <div className="h-7 w-7 rounded-lg bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <div className="mt-2.5 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{t('marketplace.noProducts')}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t('marketplace.noProductsDesc')}</p>
            </div>
          ) : (
            <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" role="list">
              {feed.map((item) => (
                <FeedCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  inCart={item.kind === 'product' && cartHas(item.id)}
                  onAddToCart={handleAddToCart}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── Overlays ── */}
      <CategorySheet
        open={catSheetOpen}
        onClose={() => setCatSheetOpen(false)}
        active={activeCategory}
        onSelect={setActiveCategory}
        enabledPlatforms={enabledPlatforms}
        locale={locale}
      />
      <AddProductDialog
        open={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        onCreated={() => { toast.success(t('marketplace.productAdded')); void fetchProductsAfterAdd(); }}
        t={t}
        locale={locale}
      />

      {/* ── Fixed bottom navigation (mobile only — desktop uses the sidebar) ── */}
      <BottomNav page={page} onOpenCategories={() => setCatSheetOpen(true)} />
      </div>

      {/* ── Existing seller application dialog, mounted on demand (desktop sidebar flow) ── */}
      {sellerApplyOpen && user && !user.isSeller && (
        <SellerApplyButton
          variant="sidebar"
          open
          onOpenChange={(v) => { if (!v) setSellerApplyOpen(false); }}
          onClose={() => setSellerApplyOpen(false)}
        />
      )}
    </>
  );
}
