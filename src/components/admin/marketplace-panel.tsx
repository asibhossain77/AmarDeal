'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Save, Plus, Trash2, Pencil, Eye, EyeOff, Image, Link2, GripVertical,
  Package, Settings, Megaphone, ShoppingCart, X, Loader2, ArrowUpDown,
  Check, Search, ToggleLeft, ToggleRight, Type, FileText, RefreshCw, Users, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useT } from '@/lib/i18n';
import { SellerAppsTab } from './seller-apps-tab';
import { cdnUrl } from '@/lib/cdn-url';

// -- Types --
interface MarketplaceSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image: string;
  link: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface AdminProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string | null;
  status: string;
  createdAt: string;
  seller: { name: string };
}

const DEFAULT_SETTINGS: MarketplaceSettings = { enabled: true, title: '', subtitle: '' };

const EMPTY_BANNER = { title: '', subtitle: '', image: '', link: '', isActive: true, sortOrder: 0 };

const CATEGORIES = [
  { key: 'all', bn: '\u09B8\u09AC', en: 'All' },
  { key: 'design', bn: '\u09A1\u09BF\u099C\u09BE\u0987\u09A8', en: 'Design' },
  { key: 'development', bn: '\u09A1\u09C7\u09AD\u09C7\u09B2\u09AA\u09AE\u09C7\u09A8\u09CD\u099F', en: 'Development' },
  { key: 'content', bn: '\u0995\u09A8\u09CD\u099F\u09C7\u09A8\u09CD\u099F', en: 'Content' },
  { key: 'marketing', bn: '\u09AE\u09BE\u09B0\u09CD\u0995\u09C7\u099F\u09BF\u0982', en: 'Marketing' },
  { key: 'education', bn: '\u09B6\u09BF\u0995\u09CD\u09B7\u09BE', en: 'Education' },
  { key: 'software', bn: '\u09B8\u09AB\u099F\u0993\u09AF\u09BC\u09CD\u09AF\u09BE\u09B0', en: 'Software' },
  { key: 'other', bn: '\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF', en: 'Other' },
];

// -- Status badge colors --
function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20';
    case 'inactive': return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/60 dark:border-zinc-500/20';
    case 'rejected': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-500/20';
    default: return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/60 dark:border-zinc-500/20';
  }
}

// -- Card wrapper --
export function SolidCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

// =============================
//  MAIN COMPONENT
// =============================

export function AdminMarketplacePanel() {
  const t = useT();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          {t('admin.marketplace.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('admin.marketplace.desc')}
        </p>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex h-11 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm rounded-lg">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.marketplace.tabSettings')}</span>
            <span className="sm:hidden">{t('admin.marketplace.tabSettingsShort')}</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="gap-1.5 text-xs sm:text-sm rounded-lg">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.marketplace.tabBanners')}</span>
            <span className="sm:hidden">{t('admin.marketplace.tabBannersShort')}</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5 text-xs sm:text-sm rounded-lg">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.marketplace.tabProducts')}</span>
            <span className="sm:hidden">{t('admin.marketplace.tabProductsShort')}</span>
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-1.5 text-xs sm:text-sm rounded-lg">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.sellerApps.tabApplications')}</span>
            <span className="sm:hidden">{t('admin.sellerApps.tabApplicationsShort')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="banners">
          <BannersTab />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="applications">
          <SellerAppsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================
//  SETTINGS TAB
// =============================

function SettingsTab() {
  const t = useT();
  const [settings, setSettings] = useState<MarketplaceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/marketplace')
      .then((r) => (r.ok ? r.json() : DEFAULT_SETTINGS))
      .catch(() => DEFAULT_SETTINGS)
      .then((data) => { setSettings({ ...DEFAULT_SETTINGS, ...data }); setLoading(false); });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/marketplace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || t('admin.marketplace.saveError'));
      }
      toast.success(t('admin.marketplace.saved'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('admin.marketplace.generalError'));
    } finally {
      setSaving(false);
    }
  }, [settings, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <SolidCard>
        <div className="space-y-5">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              {settings.enabled ? (
                <ToggleRight className="h-6 w-6 text-primary" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('admin.marketplace.enableLabel')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('admin.marketplace.enableDesc')}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => {
                const updated = { ...settings, enabled: v };
                setSettings(updated);
              }}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Type className="h-4 w-4" />
              {t('admin.marketplace.settingsTitle')}
            </Label>
            <Input
              placeholder={t('admin.marketplace.settingsTitlePh')}
              value={settings.title}
              onChange={(e) => setSettings((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('admin.marketplace.settingsSubtitle')}
            </Label>
            <Input
              placeholder={t('admin.marketplace.settingsSubtitlePh')}
              value={settings.subtitle}
              onChange={(e) => setSettings((p) => ({ ...p, subtitle: e.target.value }))}
            />
          </div>
        </div>
      </SolidCard>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? t('admin.marketplace.saving') : t('admin.marketplace.saveBtn')}
        </Button>
      </div>
    </motion.div>
  );
}

// =============================
//  BANNERS TAB
// =============================

function BannersTab() {
  const t = useT();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({ ...EMPTY_BANNER });
  const [saving, setSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerFileInputId = 'banner-image-upload';

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('সর্বোচ্চ 2MB'); return; }
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (editing?.image) fd.append('oldImage', editing.image);
      const res = await fetch('/api/upload/banner-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setForm((p) => ({ ...p, image: data.url }));
      } else {
        toast.error(data.error || 'আপলোড ব্যর্থ');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setBannerUploading(false);
      const inp = document.getElementById(bannerFileInputId) as HTMLInputElement | null;
      if (inp) inp.value = '';
    }
  };

  const loadBanners = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketplace/banners');
      if (res.ok) {
        const data = await res.json();
        setBanners(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadBanners(); }, [loadBanners]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_BANNER, sortOrder: banners.length });
    setShowForm(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle || '',
      image: b.image,
      link: b.link || '',
      isActive: b.isActive,
      sortOrder: b.sortOrder,
    });
    setShowForm(true);
  };

  const saveBanner = async () => {
    if (!form.title.trim() || !form.image.trim()) {
      toast.error(t('admin.marketplace.bannerRequired'));
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/marketplace/banners/${editing.id}` : '/api/admin/marketplace/banners';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'সমস্যা হয়েছে');
      }
      toast.success(editing ? t('admin.marketplace.bannerUpdated') : t('admin.marketplace.bannerCreated'));
      setShowForm(false);
      loadBanners();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const deleteBanner = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/marketplace/banners/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('admin.marketplace.bannerDeleted'));
        loadBanners();
      }
    } catch { /* ignore */ }
  };

  const toggleBannerStatus = async (b: Banner) => {
    try {
      const res = await fetch(`/api/admin/marketplace/banners/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      if (res.ok) {
        loadBanners();
      }
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('admin.marketplace.bannersCount').replace('{count}', String(banners.length))}
        </p>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t('admin.marketplace.addBanner')}
        </Button>
      </div>

      {/* Banner Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">
                  {editing ? t('admin.marketplace.editBanner') : t('admin.marketplace.addBanner')}
                </h3>
                <button onClick={() => setShowForm(false)} className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('admin.marketplace.bannerTitle')} *</Label>
                  <Input
                    placeholder={t('admin.marketplace.bannerTitlePh')}
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('admin.marketplace.bannerSubtitle')}</Label>
                  <Input
                    placeholder={t('admin.marketplace.bannerSubtitlePh')}
                    value={form.subtitle}
                    onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-3.5 w-3.5" />
                    {t('admin.marketplace.bannerImage')} *
                  </Label>
                  <div className="flex gap-2">
                    <label htmlFor={bannerFileInputId} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors text-sm text-muted-foreground">
                      {bannerUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {bannerUploading ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড করুন'}
                    </label>
                    <input
                      id={bannerFileInputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handleBannerImageUpload}
                      disabled={bannerUploading}
                    />
                  </div>
                  {form.image && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-border max-h-[140px] relative group">
                      <img src={cdnUrl(form.image) || ''} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setForm((p) => ({ ...p, image: '' }))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5" />
                    {t('admin.marketplace.bannerLink')}
                  </Label>
                  <Input
                    placeholder="https://example.com"
                    value={form.link}
                    onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('admin.marketplace.bannerOrder')}</Label>
                    <Input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('admin.marketplace.bannerStatus')}</Label>
                    <div className="flex items-center gap-2 h-[38px]">
                      <Switch
                        checked={form.isActive}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                      />
                      <span className="text-xs text-muted-foreground">
                        {form.isActive ? t('admin.marketplace.active') : t('admin.marketplace.inactive')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={saveBanner} disabled={saving} className="gap-2 flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('admin.marketplace.saveBanner')}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  {t('admin.marketplace.cancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banners List */}
      {banners.length === 0 ? (
        <SolidCard className="text-center py-12">
          <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{t('admin.marketplace.noBanners')}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t('admin.marketplace.noBannersDesc')}</p>
        </SolidCard>
      ) : (
        <div className="grid gap-3">
          {banners.map((b) => (
            <SolidCard key={b.id} className="!p-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Banner Image */}
                <div className="sm:w-48 h-32 sm:h-auto bg-muted relative shrink-0">
                  {b.image ? (
                    <img src={cdnUrl(b.image) || ''} alt={b.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {!b.isActive && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Badge variant="secondary" className="text-xs">{t('admin.marketplace.inactive')}</Badge>
                    </div>
                  )}
                </div>
                {/* Banner Info */}
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{b.title}</p>
                        {b.subtitle && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.subtitle}</p>
                        )}
                      </div>
                      <Badge className={statusColor(b.isActive ? 'active' : 'inactive')}>
                        {b.isActive ? t('admin.marketplace.active') : t('admin.marketplace.inactive')}
                      </Badge>
                    </div>
                    {b.link && (
                      <p className="text-[11px] text-primary mt-1.5 truncate flex items-center gap-1">
                        <Link2 className="h-3 w-3 shrink-0" />{b.link}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ArrowUpDown className="h-3 w-3" />
                      {t('admin.marketplace.order')}: {b.sortOrder}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleBannerStatus(b)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                        title={b.isActive ? t('admin.marketplace.deactivate') : t('admin.marketplace.activate')}
                      >
                        {b.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(b)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('admin.marketplace.deleteConfirm')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('admin.marketplace.deleteDesc')}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('admin.marketplace.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteBanner(b.id)} className="bg-red-500 hover:bg-red-600">
                              {t('admin.marketplace.deleteBtn')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            </SolidCard>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================
//  PRODUCTS TAB
// =============================

function ProductsTab() {
  const t = useT();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/marketplace/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const changeStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/admin/marketplace/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(t('admin.marketplace.statusUpdated'));
        loadProducts();
      } else {
        const d = await res.json();
        toast.error(d.error || 'সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সমস্যা হয়েছে');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const res = await fetch('/api/admin/marketplace/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success(t('admin.marketplace.productDeleted'));
        loadProducts();
      }
    } catch { /* ignore */ }
  };

  // Filter
  const filtered = products.filter((p) => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.seller.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  // Stats
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.status === 'active').length;
  const totalValue = products.reduce((s, p) => s + p.price, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <SolidCard className="text-center">
          <p className="text-2xl font-bold text-primary">{totalProducts}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('admin.marketplace.totalProducts')}</p>
        </SolidCard>
        <SolidCard className="text-center">
          <p className="text-2xl font-bold text-emerald-500">{activeProducts}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('admin.marketplace.activeProducts')}</p>
        </SolidCard>
        <SolidCard className="text-center">
          <p className="text-2xl font-bold text-foreground">৳{totalValue.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('admin.marketplace.totalValue')}</p>
        </SolidCard>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.marketplace.searchProducts')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">{t('admin.marketplace.allStatus')}</option>
            <option value="active">{t('admin.marketplace.active')}</option>
            <option value="inactive">{t('admin.marketplace.inactive')}</option>
            <option value="rejected">{t('admin.marketplace.rejected')}</option>
          </select>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.bn}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={loadProducts} className="gap-1.5 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Products Table (desktop) */}
      {filtered.length === 0 ? (
        <SolidCard className="text-center py-12">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{t('admin.marketplace.noProducts')}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t('admin.marketplace.noProductsAdminDesc')}</p>
        </SolidCard>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{t('admin.marketplace.colProduct')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{t('admin.marketplace.colSeller')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{t('admin.marketplace.colPrice')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{t('admin.marketplace.colCategory')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">{t('admin.marketplace.colStatus')}</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs">{t('admin.marketplace.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {p.image ? (
                            <img src={cdnUrl(p.image) || ''} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[200px]">{p.title}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">{p.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.seller.name}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">৳{p.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border ${statusColor(p.status)}`}>
                        {p.status === 'active' ? t('admin.marketplace.active') : p.status === 'inactive' ? t('admin.marketplace.inactive') : t('admin.marketplace.rejected')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'active' ? (
                          <button
                            onClick={() => changeStatus(p.id, 'inactive')}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                            title={t('admin.marketplace.deactivate')}
                          >
                            <EyeOff className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => changeStatus(p.id, 'active')}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                            title={t('admin.marketplace.activate')}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('admin.marketplace.deleteProductConfirm')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('admin.marketplace.deleteProductDesc').replace('{title}', p.title)}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('admin.marketplace.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProduct(p.id)} className="bg-red-500 hover:bg-red-600">
                                {t('admin.marketplace.deleteBtn')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden grid gap-3">
            {filtered.map((p) => (
              <SolidCard key={p.id}>
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {p.image ? (
                      <img src={cdnUrl(p.image) || ''} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{p.title}</p>
                      <Badge className={`text-[10px] border shrink-0 ${statusColor(p.status)}`}>
                        {p.status === 'active' ? t('admin.marketplace.active') : p.status === 'inactive' ? t('admin.marketplace.inactive') : t('admin.marketplace.rejected')}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.seller.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold text-foreground">৳{p.price.toLocaleString()}</p>
                      <div className="flex items-center gap-1">
                        {p.status === 'active' ? (
                          <button onClick={() => changeStatus(p.id, 'inactive')} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600">
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => changeStatus(p.id, 'active')} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('admin.marketplace.deleteProductConfirm')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('admin.marketplace.deleteProductDesc').replace('{title}', p.title)}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('admin.marketplace.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProduct(p.id)} className="bg-red-500 hover:bg-red-600">
                                {t('admin.marketplace.deleteBtn')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              </SolidCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
