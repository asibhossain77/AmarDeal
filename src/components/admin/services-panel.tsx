'use client';

/**
 * Admin SMM Service Management panel — the ONLY place where
 * Marketplace services can be created, edited, priced, published,
 * paused or removed (enforced server-side via requireAdmin).
 *
 * Tabs: Services (CRUD) · Orders (customer orders + fulfilment) · Provider
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Zap, Plus, Loader2, Pencil, Trash2, Eye, EyeOff, Pause, Play,
  Search, Package, RefreshCw, Send, CheckCircle2, XCircle, Wallet,
  CreditCard, Ban, ChevronDown, Save, X, Server, ArrowDownUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useT, type TranslationKey } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { formatMoney, formatDate, truncateLink, OrderStatusBadge } from '@/components/dashboard/my-orders-panel';
import { SERVICE_CATEGORIES } from '@/lib/marketplace-pricing';

/* ── Types ── */

interface AdminService {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePerThousand: number;
  minQuantity: number;
  maxQuantity: number;
  linkTypes: string[];
  deliveryEstimate: string | null;
  instructions: string | null;
  status: string;
  isActive: boolean;
  providerName: string | null;
  providerServiceId: string | null;
  sortOrder: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminOrder {
  id: string;
  orderNumber: string;
  user: { id: string; name: string; email: string };
  serviceName: string;
  linkUrl: string;
  quantity: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentMethodName: string | null;
  transactionId: string | null;
  createdAt: string;
}

interface AdminOrderDetail extends AdminOrder {
  senderNumber: string | null;
  unitPriceAtOrder: number;
  fulfilmentNote: string | null;
  startCount: number | null;
  remains: number | null;
  providerOrderId: string | null;
  providerStatus: string | null;
  providerError: string | null;
  events: Array<{ id: string; type: string; message: string | null; actorName: string | null; createdAt: string }>;
}

const LINK_TYPE_OPTIONS = ['profile', 'post', 'video', 'page', 'channel', 'website', 'other'];
const CATEGORY_LABELS: Record<string, { bn: string; en: string }> = {
  design: { bn: 'ডিজাইন', en: 'Design' },
  development: { bn: 'ডেভেলপমেন্ট', en: 'Development' },
  content: { bn: 'কন্টেন্ট', en: 'Content' },
  marketing: { bn: 'মার্কেটিং', en: 'Marketing' },
  education: { bn: 'শিক্ষা', en: 'Education' },
  software: { bn: 'সফটওয়্যার', en: 'Software' },
  social_media: { bn: 'সোশ্যাল মিডিয়া', en: 'Social Media' },
  id: { bn: 'আইডি', en: 'ID' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

const EMPTY_FORM = {
  name: '',
  category: 'social_media',
  description: '',
  pricePerThousand: '',
  minQuantity: '100',
  maxQuantity: '100000',
  linkTypes: ['profile'] as string[],
  deliveryEstimate: '',
  instructions: '',
  status: 'draft',
  isActive: true,
  providerName: '',
  providerServiceId: '',
  sortOrder: 0,
};

type Tab = 'services' | 'orders' | 'provider';

/* ══════════════ Services tab ══════════════ */

type TFn = ReturnType<typeof useT>

function ServicesTab({ t, bn }: { t: TFn; bn: boolean }) {
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AdminService | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketplace/services');
      const data = await res.json();
      if (data.success) setServices(data.services || []);
      else toast.error(data.error || 'Failed to load');
    } catch {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (s: AdminService) => {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      description: s.description,
      pricePerThousand: String(s.pricePerThousand),
      minQuantity: String(s.minQuantity),
      maxQuantity: String(s.maxQuantity),
      linkTypes: s.linkTypes?.length ? s.linkTypes : [],
      deliveryEstimate: s.deliveryEstimate || '',
      instructions: s.instructions || '',
      status: s.status,
      isActive: s.isActive,
      providerName: s.providerName || '',
      providerServiceId: s.providerServiceId || '',
      sortOrder: s.sortOrder || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.pricePerThousand) {
      toast.error(bn ? 'নাম, বিবরণ ও মূল্য আবশ্যক' : 'Name, description and price are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        pricePerThousand: Number(form.pricePerThousand),
        minQuantity: Number(form.minQuantity),
        maxQuantity: Number(form.maxQuantity),
        linkTypes: form.linkTypes,
        deliveryEstimate: form.deliveryEstimate.trim() || null,
        instructions: form.instructions.trim() || null,
        status: form.status,
        isActive: form.isActive,
        providerName: form.providerName.trim() || null,
        providerServiceId: form.providerServiceId.trim() || null,
        sortOrder: form.sortOrder,
      };
      const res = await fetch(
        editing ? `/api/admin/marketplace/services/${editing.id}` : '/api/admin/marketplace/services',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(editing ? (bn ? 'সার্ভিস আপডেট হয়েছে' : 'Service updated') : (bn ? 'সার্ভিস তৈরি হয়েছে' : 'Service created'));
        setDialogOpen(false);
        fetchServices();
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error(bn ? 'সেভ করা যায়নি' : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toggleField = async (s: AdminService, field: 'status' | 'isActive') => {
    setBusyId(s.id);
    try {
      const value = field === 'status' ? (s.status === 'published' ? 'draft' : 'published') : !s.isActive;
      const res = await fetch(`/api/admin/marketplace/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(bn
          ? (field === 'status' ? (value === 'published' ? 'প্রকাশিত হয়েছে' : 'আনপাবলিশ হয়েছে') : (value ? 'সক্রিয় হয়েছে' : 'নিষ্ক্রিয় হয়েছে'))
          : (field === 'status' ? (value === 'published' ? 'Published' : 'Unpublished') : (value ? 'Enabled' : 'Disabled')));
        fetchServices();
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetch(`/api/admin/marketplace/services/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(bn ? 'সার্ভিস মুছে ফেলা হয়েছে' : 'Service deleted');
        fetchServices();
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  };

  const filtered = services.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={bn ? 'সার্ভিস খুঁজুন...' : 'Search services...'} className="h-10 pl-9 text-[13px]" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="status filter"
        >
          <option value="">{bn ? 'সব স্ট্যাটাস' : 'All statuses'}</option>
          <option value="published">{bn ? 'প্রকাশিত' : 'Published'}</option>
          <option value="draft">{bn ? 'ড্রাফট' : 'Draft'}</option>
        </select>
        <Button onClick={openCreate} className="gap-2 rounded-xl text-[13px] font-semibold sm:ml-auto">
          <Plus className="h-4 w-4" />{t('adminServices.newService')}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 py-14 text-center">
          <Zap className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{bn ? 'কোনো সার্ভিস নেই — প্রথমটি তৈরি করুন' : 'No services yet — create the first one'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border/30 bg-card p-4 dark:border-border/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-bold text-foreground">{s.name}</h3>
                    {s.status === 'published' ? (
                      <Badge variant="secondary" className="gap-1 border-0 bg-primary/15 text-[10px] font-bold text-primary"><Eye className="h-2.5 w-2.5" />{bn ? 'প্রকাশিত' : 'Published'}</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 border-0 bg-muted text-[10px] font-bold text-muted-foreground"><EyeOff className="h-2.5 w-2.5" />{bn ? 'ড্রাফট' : 'Draft'}</Badge>
                    )}
                    {!s.isActive && (
                      <Badge variant="secondary" className="gap-1 border-0 bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><Pause className="h-2.5 w-2.5" />{bn ? 'বন্ধ' : 'Paused'}</Badge>
                    )}
                    {s.providerServiceId && (
                      <Badge variant="secondary" className="gap-1 border-0 bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"><Server className="h-2.5 w-2.5" />{s.providerName || 'Provider'}</Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">{s.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span dir="ltr"><span className="font-bold text-primary">{formatMoney(s.pricePerThousand)}</span> / 1,000</span>
                    <span dir="ltr">{bn ? 'পরিসর' : 'Range'}: {s.minQuantity.toLocaleString('en-BD')}–{s.maxQuantity.toLocaleString('en-BD')}</span>
                    {s.deliveryEstimate && <span dir="ltr">⏱ {s.deliveryEstimate}</span>}
                    <span>{s.orderCount} {bn ? 'অর্ডার' : 'orders'}</span>
                    <span>{CATEGORY_LABELS[s.category]?.[bn ? 'bn' : 'en'] || s.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => toggleField(s, 'status')} disabled={busyId === s.id} title={s.status === 'published' ? (bn ? 'আনপাবলিশ' : 'Unpublish') : (bn ? 'প্রকাশ করুন' : 'Publish')}>
                    {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : s.status === 'published' ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => toggleField(s, 'isActive')} disabled={busyId === s.id} title={s.isActive ? (bn ? 'বন্ধ করুন' : 'Disable') : (bn ? 'চালু করুন' : 'Enable')}>
                    {s.isActive ? <Pause className="h-4 w-4 text-amber-600" /> : <Play className="h-4 w-4 text-primary" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => openEdit(s)} title={bn ? 'সম্পাদনা' : 'Edit'}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setDeleting(s)} title={bn ? 'মুছুন' : 'Delete'}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold">{editing ? (bn ? 'সার্ভিস সম্পাদনা' : 'Edit service') : (bn ? 'নতুন সার্ভিস' : 'New service')}</DialogTitle>
            <DialogDescription className="text-[12px]">
              {bn ? 'শুধুমাত্র অ্যাডমিন সার্ভিস পরিচালনা করতে পারেন। দাম প্রতি 1,000 ইউনিটের।' : 'Only administrators can manage services. Price is per 1,000 units.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'সার্ভিসের নাম' : 'Service name'} *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={bn ? 'যেমন: ফেসবুক পেজ লাইক' : 'e.g. Facebook Page Likes'} className="text-[13px]" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'বিবরণ' : 'Description'} *</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder={bn ? 'সার্ভিস সম্পর্কে বিস্তারিত...' : 'Describe the service...'} className="text-[13px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'ক্যাটাগরি' : 'Category'}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                  {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]?.[bn ? 'bn' : 'en'] || c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'দাম (৳ / 1,000)' : 'Price (৳ / 1,000)'} *</label>
                <Input type="number" min="0.01" step="0.01" value={form.pricePerThousand} onChange={(e) => setForm({ ...form, pricePerThousand: e.target.value })} placeholder="150" className="text-[13px]" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'সর্বনিম্ন পরিমাণ' : 'Min quantity'}</label>
                <Input type="number" min="1" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} className="text-[13px]" dir="ltr" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'সর্বোচ্চ পরিমাণ' : 'Max quantity'}</label>
                <Input type="number" min="1" value={form.maxQuantity} onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })} className="text-[13px]" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'সমর্থিত লিংক টাইপ' : 'Supported link types'}</label>
              <div className="flex flex-wrap gap-1.5">
                {LINK_TYPE_OPTIONS.map((lt) => {
                  const active = form.linkTypes.includes(lt);
                  return (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => setForm({ ...form, linkTypes: active ? form.linkTypes.filter((x) => x !== lt) : [...form.linkTypes, lt] })}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground hover:border-primary/30'}`}
                    >
                      {lt.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{bn ? 'কিছু নির্বাচন না করলে যেকোনো লিংক গ্রহণযোগ্য' : 'Leave empty to accept any link'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'ডেলিভারি সময়' : 'Delivery estimate'}</label>
                <Input value={form.deliveryEstimate} onChange={(e) => setForm({ ...form, deliveryEstimate: e.target.value })} placeholder="0-6 hours" className="text-[13px]" dir="ltr" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'স্ট্যাটাস' : 'Status'}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="draft">{bn ? 'ড্রাফট (দৃশ্যমান নয়)' : 'Draft (hidden)'}</option>
                  <option value="published">{bn ? 'প্রকাশিত' : 'Published'}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'গ্রাহকের নির্দেশনা' : 'Service instructions (customer-facing)'}</label>
              <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} placeholder={bn ? 'অর্ডারের আগে গ্রাহক যা জানা দরকার...' : 'What customers should know before ordering...'} className="text-[13px]" />
            </div>
            {/* Provider mapping */}
            <div className="rounded-xl border border-border/40 p-3 dark:border-border/25">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><Server className="h-3 w-3" />{bn ? 'প্রোভাইডার ম্যাপিং (ঐচ্ছিক)' : 'Provider mapping (optional)'}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} placeholder={bn ? 'প্রোভাইডার নাম' : 'Provider name'} className="text-[12px]" dir="ltr" />
                <Input value={form.providerServiceId} onChange={(e) => setForm({ ...form, providerServiceId: e.target.value })} placeholder={bn ? 'প্রোভাইডার সার্ভিস আইডি' : 'Provider service ID'} className="text-[12px]" dir="ltr" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 dark:bg-zinc-800/40">
              <span className="text-[12px] font-medium text-foreground">{bn ? 'সক্রিয় (অর্ডারযোগ্য)' : 'Enabled (orderable)'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`relative h-6 w-11 rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.isActive ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <Button onClick={handleSave} disabled={saving} className="h-11 w-full gap-2 rounded-xl text-[13px] font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? (bn ? 'আপডেট করুন' : 'Update') : (bn ? 'তৈরি করুন' : 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{bn ? 'সার্ভিস মুছে ফেলবেন?' : 'Delete this service?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {bn
                ? `"${deleting?.name}" স্থায়ীভাবে মুছে যাবে। অর্ডারযুক্ত সার্ভিস মুছা যাবে না — বদলে Unpublish করুন।`
                : `"${deleting?.name}" will be permanently removed. Services with orders cannot be deleted — unpublish instead.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{bn ? 'বাতিল' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-white hover:bg-destructive/90">{bn ? 'মুছে ফেলুন' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ══════════════ Orders tab ══════════════ */

function OrdersTab({ t, bn }: { t: TFn; bn: boolean }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusDialogFor, setStatusDialogFor] = useState<AdminOrder | null>(null);
  const [statusForm, setStatusForm] = useState({ status: 'processing', note: '', startCount: '', remains: '' });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (paymentFilter) params.set('paymentStatus', paymentFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/marketplace/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) setOrders(data.orders || []);
      else toast.error(data.error || 'Failed');
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(), search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [fetchOrders, search]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/marketplace/orders/${id}`);
      const data = await res.json();
      if (data.success) setDetail(data.order);
      else toast.error(data.error || 'Failed');
    } catch {
      toast.error('Failed to load order');
    } finally {
      setDetailLoading(false);
    }
  };

  const orderAction = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setActionBusy(action + id);
    try {
      const res = await fetch(`/api/admin/marketplace/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(bn ? 'সম্পন্ন হয়েছে' : 'Done');
        if (detailId === id) openDetail(id);
        fetchOrders();
        return true;
      } else {
        toast.error(data.error || 'Failed');
        return false;
      }
    } catch {
      toast.error('Failed');
      return false;
    } finally {
      setActionBusy(null);
    }
  };

  const submitStatusChange = async () => {
    if (!statusDialogFor) return;
    const extra: Record<string, unknown> = { status: statusForm.status };
    if (statusForm.note.trim()) extra.note = statusForm.note.trim();
    if (statusForm.startCount) extra.startCount = Number(statusForm.startCount);
    if (statusForm.remains) extra.remains = Number(statusForm.remains);
    const ok = await orderAction(statusDialogFor.id, 'set_status', extra);
    if (ok) setStatusDialogFor(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={bn ? 'অর্ডার নম্বর / ইউজার / TXN...' : 'Order no / user / TXN...'} className="h-10 pl-9 text-[13px]" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label="order status filter">
          <option value="">{bn ? 'সব স্ট্যাটাস' : 'All statuses'}</option>
          {(['pending_payment', 'queued', 'processing', 'in_progress', 'completed', 'partial', 'cancelled', 'failed', 'refunded'] as const).map((s) => (
            <option key={s} value={s}>{t(`orderStatus.${s}`)}</option>
          ))}
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label="payment filter">
          <option value="">{bn ? 'সব পেমেন্ট' : 'All payments'}</option>
          {(['unpaid', 'awaiting_verification', 'paid', 'failed'] as const).map((s) => (
            <option key={s} value={s}>{t(`orderPayment.${s}`)}</option>
          ))}
        </select>
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl sm:ml-auto" onClick={() => fetchOrders()} aria-label="refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />)}</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 py-14 text-center">
          <Package className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{bn ? 'কোনো অর্ডার নেই' : 'No orders'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border/30 bg-card p-4 dark:border-border/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openDetail(o.id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-bold text-foreground" dir="ltr">{o.orderNumber}</span>
                    <OrderStatusBadge status={o.status} paymentStatus={o.paymentStatus} t={t} />
                    {o.paymentStatus === 'awaiting_verification' && (
                      <Badge variant="secondary" className="gap-1 border-0 bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        <CreditCard className="h-2.5 w-2.5" />{bn ? 'যাচাই দরকার' : 'verify needed'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[13px] font-semibold text-foreground">{o.serviceName} · <span className="font-normal text-muted-foreground tabular-nums">{o.quantity.toLocaleString('en-BD')}</span></p>
                  <p className="truncate text-[11px] text-muted-foreground">{o.user.name} ({o.user.email})</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[14px] font-extrabold text-primary" dir="ltr">{formatMoney(o.totalAmount)}</span>
                  <div className="flex items-center gap-1.5">
                    {o.paymentStatus === 'awaiting_verification' && o.status === 'pending_payment' && (
                      <>
                        <Button size="sm" className="h-8 gap-1 rounded-lg px-2.5 text-[11px] font-semibold" disabled={actionBusy === 'verify_payment' + o.id} onClick={() => orderAction(o.id, 'verify_payment')}>
                          {actionBusy === 'verify_payment' + o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}{bn ? 'পেমেন্ট ভেরিফাই' : 'Verify payment'}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground" disabled={actionBusy === 'reject_payment' + o.id} onClick={() => orderAction(o.id, 'reject_payment', { reason: 'Wrong transaction info' })}>
                          {actionBusy === 'reject_payment' + o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}{bn ? 'রিজেক্ট' : 'Reject'}
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => setStatusDialogFor(o)}>
                      <ArrowDownUp className="h-3 w-3" />{bn ? 'স্ট্যাটাস' : 'Status'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 rounded-lg px-2 text-[11px] font-semibold text-primary" onClick={() => openDetail(o.id)}>
                      {bn ? 'বিস্তারিত' : 'Details'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold" dir="ltr">{detail?.orderNumber || '...'}</DialogTitle>
            <DialogDescription className="text-[12px]">{detail ? `${detail.serviceName} — ${detail.user.name} (${detail.user.email})` : ''}</DialogDescription>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                <div className="rounded-xl bg-muted/40 p-3 dark:bg-zinc-800/40">
                  <p className="text-[10px] font-semibold text-muted-foreground">{bn ? 'মোট' : 'Total'}</p>
                  <p className="mt-0.5 text-[15px] font-extrabold text-primary" dir="ltr">{formatMoney(detail.totalAmount)}</p>
                  <p className="text-[10px] text-muted-foreground" dir="ltr">{formatMoney(detail.unitPriceAtOrder)}/1k × {detail.quantity.toLocaleString('en-BD')}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3 dark:bg-zinc-800/40">
                  <p className="text-[10px] font-semibold text-muted-foreground">{bn ? 'পেমেন্ট' : 'Payment'}</p>
                  <p className="mt-0.5 font-bold text-foreground">{t(`orderPayment.${detail.paymentStatus}` as TranslationKey)}</p>
                  {detail.paymentMethodName && <p className="text-[10px] text-muted-foreground">{detail.paymentMethodName} {detail.senderNumber ? `· ${detail.senderNumber}` : ''}</p>}
                  {detail.transactionId && <p className="truncate font-mono text-[10px] text-muted-foreground" dir="ltr">TXN {detail.transactionId}</p>}
                </div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 dark:bg-zinc-800/40">
                <p className="text-[10px] font-semibold text-muted-foreground">{bn ? 'টার্গেট লিংক' : 'Target link'}</p>
                <a href={detail.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all text-[12px] font-medium text-primary hover:underline" dir="ltr">{detail.linkUrl}</a>
              </div>

              {/* Fulfilment status */}
              <div className="rounded-xl border border-border/40 p-3 dark:border-border/25">
                <p className="text-[10px] font-semibold text-muted-foreground">{bn ? 'ফালফিলমেন্ট' : 'Fulfilment'}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                  <span dir="ltr">Status: <span className="font-semibold text-foreground">{detail.status}</span></span>
                  {detail.providerOrderId && <span dir="ltr">Provider ref: <span className="font-mono font-semibold text-foreground">{detail.providerOrderId}</span></span>}
                  {detail.providerStatus && <span dir="ltr">Provider: <span className="font-semibold text-foreground">{detail.providerStatus}</span></span>}
                  {detail.startCount !== null && <span dir="ltr">Start: {detail.startCount.toLocaleString('en-BD')}</span>}
                  {detail.remains !== null && <span dir="ltr">Remains: {detail.remains.toLocaleString('en-BD')}</span>}
                </div>
                {detail.providerError && (
                  <p className="mt-1.5 rounded-lg bg-red-500/10 p-2 text-[11px] font-medium text-destructive" dir="ltr">Provider error: {detail.providerError}</p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {detail.paymentStatus === 'paid' && ['queued', 'failed'].includes(detail.status) && !detail.providerOrderId && (
                    <Button size="sm" className="h-9 gap-1.5 rounded-xl text-[11px] font-semibold" disabled={actionBusy === 'provider_submit' + detail.id} onClick={() => orderAction(detail.id, 'provider_submit')}>
                      {actionBusy === 'provider_submit' + detail.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}{bn ? 'প্রোভাইডারে পাঠান' : 'Submit to provider'}
                    </Button>
                  )}
                  {detail.providerOrderId && (
                    <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl text-[11px] font-semibold" disabled={actionBusy === 'provider_sync' + detail.id} onClick={() => orderAction(detail.id, 'provider_sync')}>
                      {actionBusy === 'provider_sync' + detail.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}{bn ? 'প্রোভাইডার স্ট্যাটাস সিঙ্ক' : 'Sync provider status'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl text-[11px] font-semibold" onClick={() => { setStatusDialogFor(detail); setStatusForm({ status: detail.status === 'queued' ? 'processing' : 'in_progress', note: '', startCount: detail.startCount?.toString() || '', remains: detail.remains?.toString() || '' }); }}>
                    <ArrowDownUp className="h-3 w-3" />{bn ? 'স্ট্যাটাস পরিবর্তন' : 'Change status'}
                  </Button>
                </div>
              </div>

              {/* Event history */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground">{bn ? 'ইভেন্ট ইতিহাস' : 'Event history'}</p>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {detail.events.map((e) => (
                    <div key={e.id} className="rounded-lg bg-muted/40 p-2.5 dark:bg-zinc-800/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-foreground">{t(`orderEvent.${e.type}` as TranslationKey)}</span>
                        <span className="text-[10px] text-muted-foreground" dir="ltr">{formatDate(e.createdAt)}</span>
                      </div>
                      {e.message && <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground" dir="auto">{e.message}</p>}
                      {e.actorName && <p className="text-[10px] text-muted-foreground/70">— {e.actorName}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status change dialog */}
      <Dialog open={!!statusDialogFor} onOpenChange={(open) => !open && setStatusDialogFor(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold">{bn ? 'স্ট্যাটাস পরিবর্তন' : 'Change status'}</DialogTitle>
            <DialogDescription className="text-[12px]" dir="ltr">{statusDialogFor?.orderNumber} — {statusDialogFor?.serviceName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'নতুন স্ট্যাটাস' : 'New status'}</label>
              <select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                {(['queued', 'processing', 'in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded'] as const).map((s) => (
                  <option key={s} value={s}>{t(`orderStatus.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'স্টার্ট কাউন্ট' : 'Start count'}</label>
                <Input type="number" value={statusForm.startCount} onChange={(e) => setStatusForm({ ...statusForm, startCount: e.target.value })} className="text-[13px]" dir="ltr" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'অবশিষ্ট' : 'Remains'}</label>
                <Input type="number" value={statusForm.remains} onChange={(e) => setStatusForm({ ...statusForm, remains: e.target.value })} className="text-[13px]" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'নোট (ঐচ্ছিক)' : 'Note (optional)'}</label>
              <Textarea value={statusForm.note} onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })} rows={2} className="text-[13px]" />
            </div>
            <Button onClick={submitStatusChange} disabled={!!actionBusy} className="h-11 w-full gap-2 rounded-xl text-[13px] font-semibold">
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {bn ? 'আপডেট করুন' : 'Update status'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════ Provider tab ══════════════ */

function ProviderTab({ bn }: { bn: boolean }) {
  const [form, setForm] = useState({ name: '', apiUrl: '', apiKey: '', enabled: false });
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProvider = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketplace/provider');
      const data = await res.json();
      if (data.success) {
        setForm({ name: data.provider.name || '', apiUrl: data.provider.apiUrl || '', apiKey: '', enabled: data.provider.enabled });
        setHasKey(data.provider.hasKey);
      }
    } catch {
      toast.error('Failed to load provider settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProvider(); }, [fetchProvider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name, apiUrl: form.apiUrl, enabled: form.enabled };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      const res = await fetch('/api/admin/marketplace/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(bn ? 'প্রোভাইডার সেটিংস সেভ হয়েছে' : 'Provider settings saved');
        setForm({ ...form, apiKey: '' });
        fetchProvider();
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-border/30 bg-card p-5 dark:border-border/20">
        <h3 className="flex items-center gap-2 text-[14px] font-bold text-foreground">
          <Server className="h-4 w-4 text-primary" />{bn ? 'SMM প্রোভাইডার ইন্টিগ্রেশন' : 'SMM Provider Integration'}
        </h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {bn
            ? 'ঐচ্ছিক — কনফিগার করলে অর্ডার স্বয়ংক্রিয়ভাবে প্রোভাইডারে জমা ও সিঙ্ক করা যাবে। API কী কখনো ব্রাউজারে পাঠানো হয় না। প্রোভাইডার ছাড়া ম্যানুয়াল ফালফিলমেন্ট ব্যবহার করুন।'
            : 'Optional — when configured, orders can be submitted to and synced from your SMM provider. The API key is never exposed to the browser. Without a provider, use manual fulfilment.'}
        </p>
        <div className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'প্রোভাইডার নাম' : 'Provider name'}</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My SMM Provider" className="text-[13px]" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-foreground">{bn ? 'API URL' : 'API URL'}</label>
            <Input value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} placeholder="https://provider.example/api/v2" className="text-[13px]" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-foreground">
              {bn ? 'API কী' : 'API key'}
              {hasKey && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{bn ? 'সংরক্ষিত আছে' : 'saved'}</span>}
            </label>
            <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={hasKey ? (bn ? 'নতুন কী দিলে পরিবর্তন হবে' : 'Enter a new key to replace') : 'API key'} className="text-[13px]" dir="ltr" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 dark:bg-zinc-800/40">
            <span className="text-[12px] font-medium text-foreground">{bn ? 'প্রোভাইডার সক্রিয়' : 'Provider enabled'}</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className={`relative h-6 w-11 rounded-full transition-colors ${form.enabled ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          <Button onClick={handleSave} disabled={saving} className="h-11 w-full gap-2 rounded-xl text-[13px] font-semibold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {bn ? 'সেভ করুন' : 'Save settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ Panel shell ══════════════ */

export function AdminServicesPanel() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const bn = locale === 'bn';
  const [tab, setTab] = useState<Tab>('services');

  const tabs: Array<{ key: Tab; label: string; Icon: React.ElementType }> = [
    { key: 'services', label: bn ? 'সার্ভিস' : 'Services', Icon: Zap },
    { key: 'orders', label: bn ? 'অর্ডার' : 'Orders', Icon: Package },
    { key: 'provider', label: bn ? 'প্রোভাইডার' : 'Provider', Icon: Server },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
          <Zap className="h-5 w-5 text-primary" />
          {bn ? 'এসএমএম সার্ভিস ম্যানেজমেন্ট' : 'SMM Service Management'}
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {bn ? 'মার্কেটপ্লেস সার্ভিস ও ডিরেক্ট অর্ডার পরিচালনা করুন' : 'Manage marketplace services and customer direct orders'}
        </p>
      </div>

      <div role="tablist" className="flex w-full gap-1 overflow-x-auto rounded-xl border border-border/40 bg-muted/40 p-1 dark:border-border/25 sm:w-auto">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[12px] font-semibold transition-all sm:flex-none ${tab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'services' && <ServicesTab t={t} bn={bn} />}
      {tab === 'orders' && <OrdersTab t={t} bn={bn} />}
      {tab === 'provider' && <ProviderTab bn={bn} />}
    </div>
  );
}
