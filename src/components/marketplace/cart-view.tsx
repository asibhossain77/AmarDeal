'use client';

/**
 * CartView — the /cart page content inside the Marketplace app shell.
 *
 * Lists the cart's product references (lib/cart-store.ts is the single source
 * of truth). Checkout deliberately routes through the EXISTING product order
 * page (/product/[id]): options, quantity and price are selected/re-verified
 * there exactly as before — the cart never invents its own totals.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShoppingCart, Trash2, ArrowRight, Package } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { useCartStore, selectCartCount } from '@/lib/cart-store';
import { CATEGORIES } from '@/components/landing/marketplace-section';
import type { Product } from '@/components/landing/marketplace-section';

function formatPrice(price: number): string {
  return '৳' + price.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function productPriceLabel(p: Product): string {
  const isMulti = p.productType === 'multi' && (p.optionsCount ?? 0) > 0;
  if (isMulti && p.minPrice !== undefined && p.maxPrice !== undefined && p.minPrice !== p.maxPrice) {
    return `${formatPrice(p.minPrice)} – ${formatPrice(p.maxPrice)}`;
  }
  return formatPrice(p.price);
}

export function CartView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const count = useCartStore(selectCartCount);

  const [products, setProducts] = useState<Product[] | null>(null);

  /* Fetch product data for the cart's ids (public API, unchanged) */
  useEffect(() => {
    let alive = true;
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => { if (alive) setProducts(d?.success ? d.products || [] : []); })
      .catch(() => { if (alive) setProducts([]); });
    return () => { alive = false; };
  }, []);

  /* Products that are no longer active/available — prune silently so the
     badge count always matches what the page shows. */
  useEffect(() => {
    if (products === null) return;
    const found = new Set(products.map((p) => p.id));
    const stale = items.filter((i) => !found.has(i.productId));
    if (stale.length > 0) stale.forEach((i) => removeItem(i.productId));
  }, [products, items, removeItem]);

  const rows = useMemo(() => {
    if (products === null) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return items
      .map((i) => byId.get(i.productId))
      .filter((p): p is Product => !!p)
      .sort((a, b) => {
        const ia = items.find((i) => i.productId === a.id)?.addedAt ?? 0;
        const ib = items.find((i) => i.productId === b.id)?.addedAt ?? 0;
        return ib - ia;
      });
  }, [products, items]);

  const openProduct = (id: string) => {
    const s = useAppStore.getState();
    s.setProductDetailId(id);
    s.setView('page-product');
  };

  const loading = products === null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 sm:px-6 sm:pb-32 md:pb-10">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <ShoppingCart className="h-5 w-5 text-primary" strokeWidth={2.2} />
          {t('cart.title')}
        </h1>
        {count > 0 && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {t('cart.itemsCount', { count })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl border border-border/30 bg-card p-3 dark:border-border/20">
              <div className="h-14 w-14 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
              <div className="h-8 w-20 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShoppingCart className="h-7 w-7 text-primary" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">{t('cart.empty')}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('cart.emptyDesc')}</p>
          <button
            onClick={() => useAppStore.getState().setView('page-marketplace')}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-bold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md active:scale-[0.98]"
          >
            {t('cart.startShopping')}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2.5" role="list">
            {rows.map((p) => {
              const cat = CATEGORIES.find((c) => c.key === p.category);
              return (
                <div
                  key={p.id}
                  role="listitem"
                  className="flex items-center gap-3 rounded-xl border border-border/30 bg-card p-2.5 transition-colors dark:border-border/20"
                >
                  {/* Thumbnail */}
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg ${p.image ? 'bg-white' : 'bg-muted/60'}`}>
                    {p.image ? (
                      <img src={cdnUrl(p.image) || ''} alt={p.title} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Title + price */}
                  <button onClick={() => openProduct(p.id)} className="min-w-0 flex-1 text-left">
                    <p className="line-clamp-1 text-[13px] font-semibold text-foreground">{p.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {cat ? cat[locale === 'bn' ? 'bn' : 'en'] : p.category}
                    </p>
                    <p className={`mt-0.5 text-[13px] font-extrabold ${p.isFree ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>
                      {p.isFree ? t('marketplace.free') : productPriceLabel(p)}
                    </p>
                  </button>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <button
                      onClick={() => openProduct(p.id)}
                      className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground transition-all hover:shadow-md hover:shadow-primary/20 active:scale-95"
                    >
                      {t('cart.orderNow')}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => { removeItem(p.id); toast.success(t('cart.itemRemoved')); }}
                      aria-label={t('cart.remove')}
                      title={t('cart.remove')}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-90"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground/70">{t('cart.checkoutNote')}</p>
        </>
      )}
    </main>
  );
}
