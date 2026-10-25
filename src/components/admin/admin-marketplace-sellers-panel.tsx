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
  Users, BadgeCheck, Ban, ShieldAlert, Search, Loader2, Package, Flag,
  Store, ImageIcon, FileText, History, ShieldOff, ShieldX, RotateCcw,
  ExternalLink, ClipboardList, ShoppingBag, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — Seller Management panel.
   - All sellers with role, verification, registration date, status
   - Search / filter / sort
   - Detail dialog: profile, verification applications (documents via
     the auth-gated proxy), products, orders, reports, audit history
   - Actions: suspend / reactivate / restrict / lift restriction / report
     (server-side RBAC — support role can view but gets 403 on actions)
   ═══════════════════════════════════════════════════════════════ */

interface SellerRow {
  id: string; name: string; email: string; phone: string; imageLink: string | null;
  sellerRole: string; businessVerified: boolean;
  sellerDisabled: boolean; sellerRestricted: boolean;
  sellerSuspendedAt: string | null; sellerSuspendReason: string | null;
  businessName: string | null; businessCategory: string | null;
  createdAt: string; totalProducts: number; activeProducts: number;
  openReports: number;
  pendingApplication: { id: string; applicationType: string; idType: string | null; createdAt: string } | null;
}

interface SellerDetail {
  seller: SellerRow & { businessBio: string | null; whatsappNumber: string | null; isActive: boolean };
  applications: {
    id: string; applicationType: string; idType: string | null; idNumber: string | null;
    status: string; rejectionReason: string | null; businessName: string;
    hasDocument: boolean; createdAt: string;
  }[];
  products: {
    id: string; title: string; status: string; price: number; quantity: number;
    itemType: string; image: string | null; createdAt: string;
    moderationNote: string | null; moderatedAt: string | null; moderatedByName: string | null;
  }[];
  totalProducts: number;
  orders: { total: number; completed: number; problem: number };
  reports: { id: string; reason: string; status: string; createdAt: string; reporterName: string | null }[];
  logs: { id: string; action: string; adminName: string | null; details: string | null; createdAt: string }[];
}

type StatusFilter = 'all' | 'active' | 'suspended' | 'restricted';
type RoleFilter = 'all' | 'personal' | 'business';
type VerifyFilter = 'all' | 'verified' | 'unverified';
type SortOpt = 'newest' | 'oldest' | 'name';
type DetailTab = 'overview' | 'products' | 'verification' | 'activity';
type ActionMode = 'view' | 'suspend' | 'restrict' | 'report';

export function AdminMarketplaceSellersPanel() {
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [role, setRole] = useState<RoleFilter>('all');
  const [verification, setVerification] = useState<VerifyFilter>('all');
  const [sort, setSort] = useState<SortOpt>('newest');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<SellerDetail | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  const [actionMode, setActionMode] = useState<ActionMode>('view');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actingRow, setActingRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, status, role, verification, sort });
      const res = await fetch(`/api/admin/marketplace-sellers?${params}`);
      const json = await res.json();
      if (res.ok) {
        setSellers(json.sellers || []);
        setStats(json.stats || {});
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [q, status, role, verification, sort, t]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, q ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailTab('overview');
    setActionMode('view');
    setNote('');
    try {
      const res = await fetch(`/api/admin/marketplace-sellers/${id}`);
      const json = await res.json();
      if (res.ok) setDetail(json);
      else toast.error(json.error || t('common.error'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (payload: Record<string, unknown>, rowId?: string) => {
    if (!detail) return;
    setBusy(true);
    if (rowId) setActingRow(rowId);
    try {
      const res = await fetch(`/api/admin/marketplace-sellers/${detail.seller.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || 'OK');
        setActionMode('view');
        setNote('');
        await openDetailRefresh(detail.seller.id);
        load();
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
      setActingRow(null);
    }
  };

  const openDetailRefresh = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/marketplace-sellers/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch { /* keep current detail */ }
  };

  const quickReactivate = async (id: string) => {
    setActingRow(id);
    try {
      const res = await fetch(`/api/admin/marketplace-sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });
      const json = await res.json();
      if (res.ok) { toast.success(json.message); load(); }
      else toast.error(json.error || t('common.error'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setActingRow(null);
    }
  };

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

  const statusBadge = (s: SellerRow) => {
    if (s.sellerRestricted) {
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 text-[11px]">{t('adminMkt.statusRestricted')}</Badge>;
    }
    if (s.sellerDisabled) {
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0 text-[11px]">{t('adminMkt.statusSuspended')}</Badge>;
    }
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[11px]">{t('adminMkt.statusActive')}</Badge>;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{t('adminMkt.sellersTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('adminMkt.sellersDesc')}</p>
      </div>

      {/* Stats chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: t('adminMkt.statTotalSellers'), value: stats.totalSellers || 0, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
          { icon: BadgeCheck, label: t('adminMkt.statVerifiedBusiness'), value: stats.verifiedBusiness || 0, cls: 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400' },
          { icon: ClipboardList, label: t('adminMkt.statPendingVerification'), value: stats.pendingApplications || 0, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
          { icon: Ban, label: t('adminMkt.statSuspended'), value: stats.suspendedSellers || 0, cls: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400' },
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
            placeholder={t('adminMkt.searchSellers')}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {chips([
            { value: 'all', label: t('adminMkt.filterAll') },
            { value: 'active', label: t('adminMkt.filterActive') },
            { value: 'suspended', label: t('adminMkt.filterSuspended') },
            { value: 'restricted', label: t('adminMkt.filterRestricted') },
          ], status, setStatus)}
          {chips([
            { value: 'all', label: t('adminMkt.roleAll') },
            { value: 'personal', label: t('adminMkt.rolePersonal') },
            { value: 'business', label: t('adminMkt.roleBusiness') },
          ], role, setRole)}
          {chips([
            { value: 'newest', label: t('adminMkt.sortNewest') },
            { value: 'oldest', label: t('adminMkt.sortOldest') },
            { value: 'name', label: t('adminMkt.sortName') },
          ], sort, setSort)}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : sellers.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-6 text-center">{t('adminMkt.noSellers')}</p>
      ) : (
        <div className="space-y-2.5">
          {sellers.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/60 p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Identity */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary overflow-hidden"
                    style={s.imageLink ? { backgroundImage: `url(${s.imageLink})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    {!s.imageLink && (s.name?.charAt(0) || 'S')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      {s.businessName || s.name}
                      {s.businessVerified && <BadgeCheck className="h-3.5 w-3.5 text-teal-500 shrink-0" />}
                      {s.openReports > 0 && (
                        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-0 text-[10px] px-1.5 py-0 h-4">
                          <Flag className="h-2.5 w-2.5 mr-0.5" />{s.openReports}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                  </div>
                </div>
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border/60 text-muted-foreground">
                    {s.sellerRole === 'business' ? t('adminMkt.roleBusiness') : t('adminMkt.rolePersonal')}
                  </Badge>
                  {statusBadge(s)}
                  <span className="text-[11px] text-muted-foreground hidden md:inline-flex items-center gap-1">
                    <Package className="h-3 w-3" />{s.totalProducts}
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden lg:inline">{fmtDate(s.createdAt)}</span>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 sm:ml-2">
                  {s.sellerDisabled && !s.sellerRestricted && (
                    <Button
                      size="sm" variant="outline"
                      disabled={actingRow === s.id}
                      onClick={() => quickReactivate(s.id)}
                      className="h-8 text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      {actingRow === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                      {t('adminMkt.reactivate')}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openDetail(s.id)} className="h-8 text-xs">
                    {t('adminMkt.manage')}
                  </Button>
                </div>
              </div>
              {s.sellerDisabled && s.sellerSuspendReason && (
                <p className="mt-2 text-[11px] text-orange-600 dark:text-orange-400 flex items-start gap-1.5">
                  <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
                  {t('adminMkt.suspendReasonLabel')}: {s.sellerSuspendReason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Detail dialog ── */}
      <Dialog open={detailOpen} onOpenChange={(v) => { if (!v) { setDetailOpen(false); setActionMode('view'); } }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-primary" />
              {detail?.seller.businessName || detail?.seller.name || t('adminMkt.sellerDetails')}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {/* Profile summary */}
              <div className="rounded-xl bg-muted/40 border border-border/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(detail.seller as SellerRow)}
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border/60 text-muted-foreground">
                    {detail.seller.sellerRole === 'business' ? t('adminMkt.roleBusiness') : t('adminMkt.rolePersonal')}
                  </Badge>
                  {detail.seller.businessVerified && (
                    <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400 border-0 text-[10px]">
                      <BadgeCheck className="h-3 w-3 mr-1" />{t('adminMkt.verifiedBadge')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{detail.seller.name} · {detail.seller.email} · {detail.seller.phone}</p>
                <p className="text-[11px] text-muted-foreground/80">
                  {t('adminMkt.registeredAt')}: {fmtDate(detail.seller.createdAt)}
                  {' · '}{t('adminMkt.productsCount')}: {detail.totalProducts}
                  {' · '}{t('adminMkt.ordersCount')}: {detail.orders.total} ({detail.orders.completed} ✓)
                </p>
                {detail.seller.sellerDisabled && detail.seller.sellerSuspendReason && (
                  <p className="text-[11px] text-orange-600 dark:text-orange-400">
                    {t('adminMkt.suspendReasonLabel')}: {detail.seller.sellerSuspendReason}
                  </p>
                )}
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['overview', t('adminMkt.tabOverview')],
                  ['products', `${t('adminMkt.tabProducts')} (${detail.totalProducts})`],
                  ['verification', `${t('adminMkt.tabVerification')} (${detail.applications.length})`],
                  ['activity', t('adminMkt.tabActivity')],
                ] as [DetailTab, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDetailTab(key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      detailTab === key
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'border-border/60 text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab: overview — actions + quick stats */}
              {detailTab === 'overview' && (
                <div className="space-y-3">
                  {actionMode === 'view' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {detail.seller.sellerDisabled ? (
                        !detail.seller.sellerRestricted && (
                          <Button
                            variant="outline" size="sm"
                            disabled={busy}
                            onClick={() => runAction({ action: 'reactivate' })}
                            className="text-emerald-600 hover:text-emerald-700 border-emerald-200"
                          >
                            <RotateCcw className="h-4 w-4 mr-1.5" />{t('adminMkt.reactivate')}
                          </Button>
                        )
                      ) : (
                        <Button variant="outline" size="sm" disabled={busy}
                          onClick={() => { setActionMode('suspend'); setNote(''); }}
                          className="text-orange-600 hover:text-orange-700 border-orange-200"
                        >
                          <ShieldOff className="h-4 w-4 mr-1.5" />{t('adminMkt.suspend')}
                        </Button>
                      )}
                      {!detail.seller.sellerRestricted && (
                        <Button variant="outline" size="sm" disabled={busy}
                          onClick={() => { setActionMode('restrict'); setNote(''); }}
                          className="text-red-600 hover:text-red-700 border-red-200"
                        >
                          <ShieldX className="h-4 w-4 mr-1.5" />{t('adminMkt.restrict')}
                        </Button>
                      )}
                      {detail.seller.sellerRestricted && (
                        <Button variant="outline" size="sm" disabled={busy}
                          onClick={() => runAction({ action: 'lift_restriction' })}
                          className="text-emerald-600 hover:text-emerald-700 border-emerald-200"
                        >
                          <ShieldOff className="h-4 w-4 mr-1.5" />{t('adminMkt.liftRestriction')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" disabled={busy}
                        onClick={() => { setActionMode('report'); setNote(''); }}
                      >
                        <Flag className="h-4 w-4 mr-1.5" />{t('adminMkt.reportSeller')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">
                          {actionMode === 'report' ? t('adminMkt.reportReasonLabel') : t('adminMkt.reasonRequired')} *
                        </Label>
                        <button onClick={() => setActionMode('view')} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder={t('adminMkt.reasonPlaceholder')}
                      />
                      <Button
                        size="sm"
                        disabled={busy || !note.trim()}
                        onClick={() => runAction(
                          actionMode === 'suspend' ? { action: 'suspend', reason: note.trim() }
                          : actionMode === 'restrict' ? { action: 'restrict', reason: note.trim() }
                          : { action: 'report', reason: note.trim() },
                        )}
                      >
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                        {t('adminMkt.confirm')}
                      </Button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {t('adminMkt.suspendHint')}
                  </p>
                </div>
              )}

              {/* Tab: products */}
              {detailTab === 'products' && (
                <div className="space-y-2">
                  {detail.products.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">{t('adminMkt.noProducts')}</p>
                  ) : detail.products.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border/50 p-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.image
                          ? <img src={p.image} alt="" className="h-full w-full object-cover" />
                          : <Package className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          ৳{p.price} · {p.itemType === 'physical' ? t('adminMkt.physical') : t('adminMkt.nonPhysical')} · {fmtDate(p.createdAt)}
                        </p>
                        {p.moderationNote && (
                          <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                            {p.moderationNote} ({p.moderatedByName || '—'})
                          </p>
                        )}
                      </div>
                      <StatusChip status={p.status} t={t} />
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: verification */}
              {detailTab === 'verification' && (
                <div className="space-y-2">
                  {detail.applications.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">{t('adminMkt.noApplications')}</p>
                  ) : detail.applications.map((a) => (
                    <div key={a.id} className="rounded-xl border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-medium text-foreground">
                          {a.businessName}
                          <span className="text-muted-foreground font-normal"> · {fmtDate(a.createdAt)}</span>
                        </p>
                        <Badge
                          className={`border-0 text-[10px] ${
                            a.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : a.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                            : a.status === 'disabled' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          }`}
                        >
                          {a.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {a.applicationType === 'business' ? t('adminMkt.roleBusiness') : t('adminMkt.rolePersonal')}
                        {a.idType ? ` · ${a.idType === 'nid' ? t('adminMkt.idNid') : t('adminMkt.idTradeLicence')}: ${a.idNumber || '—'}` : ''}
                      </p>
                      {a.rejectionReason && (
                        <p className="text-[11px] text-red-500">{t('adminMkt.rejectionReason')}: {a.rejectionReason}</p>
                      )}
                      {a.hasDocument && (
                        <a
                          href={`/api/admin/marketplace-sellers/${detail.seller.id}/document?app=${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                        >
                          <ImageIcon className="h-3.5 w-3.5 text-emerald-500" />
                          {t('adminMkt.viewDocument')}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    {t('adminMkt.documentSecurityNote')}
                  </p>
                </div>
              )}

              {/* Tab: activity — reports + audit trail */}
              {detailTab === 'activity' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1.5">{t('adminMkt.reportsAgainst')}</p>
                    {detail.reports.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">{t('adminMkt.noReports')}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.reports.map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                            <p className="text-[11px] text-foreground truncate">{r.reason}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">{r.status} · {fmtDate(r.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1.5">{t('adminMkt.auditTrail')}</p>
                    {detail.logs.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">{t('adminMkt.noLogs')}</p>
                    ) : (
                      <div className="space-y-1">
                        {detail.logs.map((l) => (
                          <p key={l.id} className="text-[11px] text-muted-foreground/80 flex items-start gap-1.5">
                            <History className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="font-mono text-primary">{l.action}</span>
                            {' · '}{l.adminName || 'Admin'}{' · '}{fmtDate(l.createdAt)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShoppingBag className="h-3 w-3" />
                    {t('adminMkt.ordersSummary')}: {detail.orders.total} · ✓ {detail.orders.completed} · ⚠ {detail.orders.problem}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusChip({ status, t }: { status: string; t: (k: TranslationKey) => string }) {
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
