'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT, type TranslationKey } from '@/lib/i18n';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Package, Search, Loader2, Flag, CheckCircle2, XCircle, EyeOff,
  Trash2, RotateCcw, ShieldAlert, ImageIcon, X, Clock,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — Product Management panel.
   All marketplace products (every status) with seller info, type,
   category, price, stock and publication status.
   Actions: approve / reject / unpublish / remove / restore / flag.
   Rejected-then-edited products automatically return to the pending
   queue (server-enforced); this panel is where they get re-reviewed.
   ═══════════════════════════════════════════════════════════════ */

interface ProductRow {
  id: string; title: string; price: number; category: string; image: string | null;
  itemType: string; digitalKind: string | null; productType: string; status: string;
  quantity: number; isFree: boolean;
  moderationNote: string | null; moderatedAt: string | null; moderatedByName: string | null;
  createdAt: string; sellerId: string;
  seller: {
    id: string; name: string; email: string; businessName: string | null;
    sellerRole: string; businessVerified: boolean; sellerDisabled: boolean;
  } | null;
  openReports: number;
}

type StatusFilter = 'all' | 'pending' | 'active' | 'rejected' | 'unpublished' | 'removed';
type ItemFilter = 'all' | 'physical' | 'non_physical';
type SortOpt = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
type ActionMode = 'reject' | 'unpublish' | 'remove' | 'flag' | null;

export function AdminMarketplaceProductsPanel() {
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [itemType, setItemType] = useState<ItemFilter>('all');
  const [sort, setSort] = useState<SortOpt>('newest');

  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [actionProduct, setActionProduct] = useState<ProductRow | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, status, itemType, sort });
      const res = await fetch(`/api/admin/marketplace-products?${params}`);
      const json = await res.json();
      if (res.ok) {
        setProducts(json.products || []);
        setStats(json.stats || {});
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [q, status, itemType, sort, t]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, q ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const runAction = async (action: string, reason: string | undefined, productId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/marketplace-products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || 'OK');
        setActionMode(null);
        setActionProduct(null);
        setNote('');
        load();
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const quickAction = (action: string, p: ProductRow) => runAction(action, undefined, p.id);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const chips = (options: { value: string; label: string }[], current: string, set: (v: never) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value as never)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            current === o.value
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{t('adminMkt.productsTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('adminMkt.productsDesc')}</p>
      </div>

      {/* Stats chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Package, label: t('adminMkt.statTotalProducts'), value: stats.total || 0, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
          { icon: Clock, label: t('adminMkt.statPendingProducts'), value: stats.pending || 0, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
          { icon: CheckCircle2, label: t('adminMkt.statActiveProducts'), value: stats.active || 0, cls: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400' },
          { icon: Flag, label: t('adminMkt.statReported'), value: stats.reported || 0, cls: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/60 p-3.5">
            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.cls}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground tabular-nums">{s.value}</p>
            <p className="text-[11px] font-medium text-muted-foreground leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('adminMkt.searchProducts')}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {chips([
            { value: 'all', label: t('adminMkt.filterAll') },
            { value: 'pending', label: t('adminMkt.psPending') },
            { value: 'active', label: t('adminMkt.psActive') },
            { value: 'rejected', label: t('adminMkt.psRejected') },
            { value: 'unpublished', label: t('adminMkt.psUnpublished') },
            { value: 'removed', label: t('adminMkt.psRemoved') },
          ], status, setStatus)}
          {chips([
            { value: 'all', label: t('adminMkt.itemAll') },
            { value: 'physical', label: t('adminMkt.physical') },
            { value: 'non_physical', label: t('adminMkt.nonPhysical') },
          ], itemType, setItemType)}
          {chips([
            { value: 'newest', label: t('adminMkt.sortNewest') },
            { value: 'oldest', label: t('adminMkt.sortOldest') },
            { value: 'price_desc', label: t('adminMkt.sortPriceHigh') },
            { value: 'price_asc', label: t('adminMkt.sortPriceLow') },
          ], sort, setSort)}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-6 text-center">{t('adminMkt.noProductsFound')}</p>
      ) : (
        <div className="space-y-2.5">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/60 p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Identity */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-muted/60 flex items-center justify-center overflow-hidden">
                    {p.image
                      ? <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      {p.title}
                      {p.openReports > 0 && (
                        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-0 text-[10px] px-1.5 py-0 h-4">
                          <Flag className="h-2.5 w-2.5 mr-0.5" />{p.openReports}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.seller ? (p.seller.businessName || p.seller.name) : '—'}
                      {' · '}৳{p.isFree ? t('adminMkt.free') : p.price}
                      {' · '}{p.itemType === 'physical' ? t('adminMkt.physical') : t('adminMkt.nonPhysical')}
                      {' · '}{t('adminMkt.stock')}: {p.quantity}
                    </p>
                  </div>
                </div>
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <ProductStatusChip status={p.status} t={t} />
                  {p.seller?.sellerDisabled && (
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0 text-[10px]">
                      {t('adminMkt.sellerSuspendedShort')}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground hidden lg:inline">{fmtDate(p.createdAt)}</span>
                </div>
              </div>

              {/* Moderation note */}
              {p.moderationNote && (
                <p className="mt-2 text-[11px] text-orange-600 dark:text-orange-400 flex items-start gap-1.5">
                  <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
                  {p.moderationNote} {p.moderatedByName ? `· ${p.moderatedByName}${p.moderatedAt ? ` · ${fmtDate(p.moderatedAt)}` : ''}` : ''}
                </p>
              )}

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-border/40">
                {p.status === 'pending' && (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => quickAction('approve', p)}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t('adminMkt.approve')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => { setActionMode('reject'); setActionProduct(p); setNote(''); }}
                      className="h-7 text-xs text-red-600 hover:text-red-700 border-red-200">
                      <XCircle className="h-3.5 w-3.5 mr-1" />{t('adminMkt.reject')}
                    </Button>
                  </>
                )}
                {(p.status === 'active' || p.status === 'inactive' || p.status === 'sold') && (
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => { setActionMode('unpublish'); setActionProduct(p); setNote(''); }}
                    className="h-7 text-xs text-orange-600 hover:text-orange-700 border-orange-200">
                    <EyeOff className="h-3.5 w-3.5 mr-1" />{t('adminMkt.unpublish')}
                  </Button>
                )}
                {p.status !== 'removed' && (
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => { setActionMode('remove'); setActionProduct(p); setNote(''); }}
                    className="h-7 text-xs text-red-600 hover:text-red-700 border-red-200">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />{t('adminMkt.remove')}
                  </Button>
                )}
                {['rejected', 'unpublished', 'removed'].includes(p.status) && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => quickAction('restore', p)}
                    className="h-7 text-xs text-emerald-600 hover:text-emerald-700 border-emerald-200">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />{t('adminMkt.restore')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={busy}
                  onClick={() => { setActionMode('flag'); setActionProduct(p); setNote(''); }}
                  className="h-7 text-xs text-muted-foreground">
                  <Flag className="h-3.5 w-3.5 mr-1" />{t('adminMkt.flagProduct')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reason dialog (reject / unpublish / remove / flag) */}
      <Dialog open={!!actionMode && !!actionProduct} onOpenChange={(v) => { if (!v) { setActionMode(null); setActionProduct(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {actionMode === 'reject' && <XCircle className="h-4 w-4 text-red-500" />}
              {actionMode === 'unpublish' && <EyeOff className="h-4 w-4 text-orange-500" />}
              {actionMode === 'remove' && <Trash2 className="h-4 w-4 text-red-500" />}
              {actionMode === 'flag' && <Flag className="h-4 w-4 text-rose-500" />}
              {actionProduct?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  {actionMode === 'flag' ? t('adminMkt.reportReasonLabel') : t('adminMkt.reasonRequired')} *
                </Label>
                <button onClick={() => { setActionMode(null); setActionProduct(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t('adminMkt.reasonPlaceholder')}
              />
              <p className="text-[11px] text-muted-foreground">
                {actionMode === 'flag' ? t('adminMkt.flagHint') : t('adminMkt.reasonHint')}
              </p>
            </div>
            <Button
              className="w-full"
              disabled={busy || !note.trim()}
              onClick={() => actionProduct && runAction(actionMode!, note.trim(), actionProduct.id)}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {actionMode === 'reject' && t('adminMkt.reject')}
              {actionMode === 'unpublish' && t('adminMkt.unpublish')}
              {actionMode === 'remove' && t('adminMkt.remove')}
              {actionMode === 'flag' && t('adminMkt.submitReport')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductStatusChip({ status, t }: { status: string; t: (k: TranslationKey) => string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    unpublished: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
    removed: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-400',
    inactive: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    sold: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  };
  const labelMap: Record<string, string> = {
    active: 'adminMkt.psActive', pending: 'adminMkt.psPending', rejected: 'adminMkt.psRejected',
    unpublished: 'adminMkt.psUnpublished', removed: 'adminMkt.psRemoved', inactive: 'adminMkt.psInactive',
    sold: 'adminMkt.psSold',
  };
  return (
    <Badge className={`border-0 text-[10px] shrink-0 ${map[status] || map.inactive}`}>
      {t((labelMap[status] || 'adminMkt.psActive') as TranslationKey)}
    </Badge>
  );
}
