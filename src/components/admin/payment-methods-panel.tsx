'use client';
import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useT } from '@/lib/i18n';

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Palette,
  Eye,
  Wallet,
  ImageIcon,
} from 'lucide-react';

const emptySubscribe = () => () => {};

/* ─── Types ─── */
interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  accountType: string;
  status: string;
  sortOrder: number;
  color: string;
  image: string | null;
  createdAt: string;
}

interface FormData {
  name: string;
  accountNumber: string;
  accountType: string;
  status: string;
  sortOrder: number;
  color: string;
  image: string;
}

const emptyForm: FormData = {
  name: '',
  accountNumber: '',
  accountType: 'personal',
  status: 'active',
  sortOrder: 0,
  color: '#84CC16',
  image: '',
};

/* ─── Known Gateway Defaults ─── */
function getGatewayColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('bkash')) return '#E2136E';
  if (n.includes('nagad')) return '#F6921E';
  if (n.includes('rocket')) return '#8C3494';
  if (n.includes('bank')) return '#0033A0';
  if (n.includes('upay')) return '#1A9F4B';
  if (n.includes('dutch') || n.includes('bangla')) return '#FF6600';
  return '#84CC16';
}

function getGatewayIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('bank')) return '🏦';
  return '💳';
}

/* ─── Solid Card Helper ─── */
function SolidCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl bg-white p-5 sm:p-6 shadow-2xl shadow-gray-300/50 dark:bg-zinc-900 dark:shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Color Picker Row ─── */
function ColorPickerRow({
  color,
  onChange,
  label,
}: {
  color: string;
  onChange: (c: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-border p-1 bg-transparent"
          />
        </div>
        <Input
          value={color}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
              onChange(v.length === 7 ? v : color);
            }
          }}
          className="w-32 h-10 font-mono text-sm"
        />
        <div
          className="h-10 w-20 rounded-xl border border-border/50 shrink-0"
          style={{ backgroundColor: color }}
        />
      </div>
      {/* Quick color presets */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {['#E2136E', '#F6921E', '#8C3494', '#0033A0', '#1A9F4B', '#84CC16', '#65A30D', '#2563EB', '#DC2626', '#7C3AED'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: color === c ? 'var(--foreground)' : 'transparent',
            }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Admin Payment Methods Panel
   ═══════════════════════════════════════════ */

export function PaymentMethodsPanel() {
  const t = useT();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-methods');
      if (res.ok) setMethods(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  // ─── CRUD Handlers ───
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      accountNumber: m.accountNumber,
      accountType: m.accountType,
      status: m.status,
      sortOrder: m.sortOrder,
      color: m.color || '#84CC16',
      image: m.image || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.accountNumber.trim()) {
      toast.error(t('admin.payments.nameAndNumberRequired'));
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/payment-methods/${editingId}`
        : '/api/admin/payment-methods';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        ...form,
        image: form.image.trim() || undefined,
      }),
      });
      if (res.ok) {
        toast.success(editingId ? t('admin.payments.methodUpdated') : t('admin.payments.methodAdded'));
        setDialogOpen(false);
        fetchMethods();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.payments.saveFailed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('admin.payments.methodDeleted'));
        fetchMethods();
      } else {
        toast.error(t('admin.payments.deleteFailed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setDeletingId(null);
    }
  };

  // Quick color change from table
  const handleQuickColorChange = async (id: string, color: string) => {
    try {
      const res = await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      if (res.ok) {
        fetchMethods();
      }
    } catch {
      // silent
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingAnimation size="lg" />
      </div>
    );

  const activeMethods = methods.filter((m) => m.status === 'active');

  return (
    <div className="space-y-6">
      {/* ═══ Section 1: Payment Methods CRUD ═══ */}
      <div>
        {/* Header */}
        <div className="mb-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {t('admin.payments.management')}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('admin.payments.managementDesc')}
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="h-9 gap-1.5 rounded-lg text-xs font-semibold shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            {t('admin.payments.addGateway')}
          </Button>
        </div>

        {/* Table Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {methods.length === 0 ? (
            <SolidCard>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CreditCard className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  {t('admin.payments.noGateways')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('admin.payments.noGatewayHint')}
                </p>
              </div>
            </SolidCard>
          ) : (
            <>
              {/* Desktop Table */}
              <SolidCard className="!p-0 overflow-hidden hidden lg:block">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.payments.gateway')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.payments.accountNumber')}</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.payments.type')}</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.payments.color')}</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.users.status')}</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('common.edit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map((m) => (
                      <tr key={m.id} className="border-b border-border/30 transition-colors hover:bg-muted/20 last:border-0">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm" style={{ backgroundColor: `${m.color || '#84CC16'}18` }}>
                              <Wallet className="h-4 w-4" style={{ color: m.color || '#84CC16' }} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{m.name}</p>
                              <p className="text-[11px] text-muted-foreground">{t('admin.payments.sortOrder')}: {m.sortOrder}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{m.accountNumber}</td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          {m.accountType === 'merchant' ? (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">{t("admin.payments.merchant")}</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 font-medium">{t("admin.payments.personal")}</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <div className="relative h-8 w-8 rounded-lg border border-border/50 cursor-pointer transition-transform hover:scale-110" style={{ backgroundColor: m.color || '#84CC16' }} title={t('admin.payments.editGateway')}>
                              <input type="color" value={m.color || '#84CC16'} onChange={(e) => handleQuickColorChange(m.id, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground">{m.color || '#84CC16'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          {m.status === 'active' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium">{t("common.active")}</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium">{t("common.inactive")}</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(m)} className="h-8 gap-1.5 rounded-lg text-xs font-medium"><Pencil className="h-3.5 w-3.5" /> {t("common.edit")}</Button>
                            <Button size="sm" variant="outline" disabled={deletingId === m.id} onClick={() => handleDelete(m.id)} className="h-8 gap-1.5 rounded-lg text-xs font-medium border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-500/10">
                              {deletingId === m.id ? <LoadingAnimation size="sm" /> : <Trash2 className="h-3.5 w-3.5" />} {t("common.delete")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SolidCard>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {methods.map((m) => (
                  <div key={m.id} className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${m.color || '#84CC16'}18` }}>
                          <Wallet className="h-4 w-4" style={{ color: m.color || '#84CC16' }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{m.accountNumber}</p>
                        </div>
                      </div>
                      <div className="relative h-7 w-7 rounded-lg border border-border/50" style={{ backgroundColor: m.color || '#84CC16' }}>
                        <input type="color" value={m.color || '#84CC16'} onChange={(e) => handleQuickColorChange(m.id, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.accountType === 'merchant' ? (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 text-[11px] font-medium">{t("admin.payments.merchant")}</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-0 text-[11px] font-medium">{t("admin.payments.personal")}</Badge>
                        )}
                        {m.status === 'active' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[11px] font-medium">{t("common.active")}</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 text-[11px] font-medium">{t("common.inactive")}</Badge>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openEdit(m)} className="h-8 px-2.5 rounded-lg text-[11px] font-medium"><Pencil className="h-3 w-3" /> {t("common.edit")}</Button>
                        <Button size="sm" variant="outline" disabled={deletingId === m.id} onClick={() => handleDelete(m.id)} className="h-8 px-2.5 rounded-lg text-[11px] font-medium border-red-200 text-red-600 dark:border-red-800/50 dark:text-red-400">
                          {deletingId === m.id ? <LoadingAnimation size="sm" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ═══ Section 2: Per-Gateway Color Preview ═══ */}
      {activeMethods.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="hidden lg:block"
        >
          <div className="mb-5 text-center sm:text-left">
            <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
              <Palette className="h-5 w-5 text-primary" />
              {t("admin.payments.colorPreview")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("admin.payments.colorPreviewDesc")}
            </p>
          </div>

          <SolidCard>
            <div className="space-y-5">
              {/* Method cards preview with individual colors */}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    {t("admin.payments.pagePreview")}
                  </span>
                </div>

                {/* Gateway cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                  {activeMethods.map((m, i) => {
                    const c = m.color || '#84CC16';
                    const isSelected = i === 0;
                    return (
                      <motion.button
                        key={m.id}
                        type="button"
                        className="rounded-xl border-2 p-3 text-center transition-all text-xs font-medium"
                        style={{
                          borderColor: isSelected ? c : 'hsl(var(--border))',
                          backgroundColor: isSelected ? `${c}15` : 'transparent',
                          color: isSelected ? c : 'hsl(var(--foreground))',
                        }}
                      >
                        <div
                          className="mx-auto mb-1.5 h-9 w-9 rounded-lg flex items-center justify-center text-base"
                          style={{ backgroundColor: `${c}20` }}
                        >
                          {getGatewayIcon(m.name)}
                        </div>
                        <p className="font-semibold">{m.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] opacity-70">
                          {m.accountNumber}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Mini info box with first gateway's color */}
                {activeMethods.length > 0 && (
                  <>
                    <div
                      className="mb-4 rounded-xl border-l-4 bg-white dark:bg-zinc-800 p-3"
                      style={{ borderLeftColor: activeMethods[0].color || '#84CC16' }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t("admin.payments.totalAmount")}</span>
                        <span
                          className="font-bold"
                          style={{ color: activeMethods[0].color || '#84CC16' }}
                        >
                          ৳1,03,000.00
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">
                          {activeMethods[0].name}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {activeMethods[0].accountNumber}
                        </span>
                      </div>
                    </div>

                    {/* Mini confirm button */}
                    <button
                      className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        backgroundColor: activeMethods[0].color || '#84CC16',
                        color: getContrastColor(activeMethods[0].color || '#84CC16'),
                      }}
                    >
                      <ShieldCheckIcon />
                      {t("admin.payments.confirmPayment")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </SolidCard>
        </motion.div>
      )}

      {/* ═══ Add/Edit Dialog ═══ */}
      <AnimatePresence>
        {dialogOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setDialogOpen(false)}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-gray-300/50 dark:bg-zinc-900 dark:shadow-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">
                    {editingId ? t('admin.payments.editGateway') : t('admin.payments.addGatewayTitle')}
                  </h3>
                  <button
                    onClick={() => setDialogOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal Form */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t("admin.payments.gatewayName")}</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm({
                          ...form,
                          name,
                          // Auto-suggest color for new gateways
                          ...(!editingId && { color: getGatewayColor(name) }),
                        });
                      }}
                      placeholder="e.g.: bKash, Nagad, Rocket"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      {t("admin.payments.accountNumber")}
                    </Label>
                    <Input
                      value={form.accountNumber}
                      onChange={(e) =>
                        setForm({ ...form, accountNumber: e.target.value })
                      }
                      placeholder="01XXXXXXXXX"
                    />
                  </div>

                  <ColorPickerRow
                    label={t("admin.payments.gatewayColor")}
                    color={form.color}
                    onChange={(c) => setForm({ ...form, color: c })}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        {t("admin.payments.accountType")}
                      </Label>
                      <select
                        value={form.accountType}
                        onChange={(e) =>
                          setForm({ ...form, accountType: e.target.value })
                        }
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="personal">{t("admin.payments.personal")}</option>
                        <option value="merchant">{t("admin.payments.merchant")}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t("admin.users.status")}</Label>
                      <select
                        value={form.status}
                        onChange={(e) =>
                          setForm({ ...form, status: e.target.value })
                        }
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="active">{t("common.active")}</option>
                        <option value="inactive">{t("common.inactive")}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t("admin.payments.sortOrder")}</Label>
                    <Input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sortOrder: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.payments.sortOrderHint")}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {t("admin.payments.logoImageLink")}
                    </Label>
                    <Input
                      value={form.image}
                      onChange={(e) =>
                        setForm({ ...form, image: e.target.value })
                      }
                      placeholder="https://example.com/logo.png"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.payments.logoImageHint")}
                    </p>
                  </div>

                  {/* Live preview of the gateway card */}
                  <div className="rounded-xl border-2 p-3 text-center transition-all text-xs font-medium"
                    style={{
                      borderColor: form.color,
                      backgroundColor: `${form.color}15`,
                      color: form.color,
                    }}
                  >
                    <div
                      className="mx-auto mb-1.5 h-10 w-10 rounded-lg flex items-center justify-center text-lg overflow-hidden"
                      style={{ backgroundColor: form.image ? 'transparent' : `${form.color}20` }}
                    >
                      {form.image ? (
                        <img
                          src={form.image}
                          alt={form.name}
                          className="h-full w-full object-contain"
                          loading="lazy" decoding="async"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        getGatewayIcon(form.name || 'Gateway')
                      )}
                    </div>
                    <p className="font-semibold text-sm">
                      {form.name || t('admin.payments.gatewayName')}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] opacity-70">
                      {form.accountNumber || t('admin.payments.accountNumber')}
                    </p>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="h-10 rounded-xl px-5 text-sm font-medium"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-10 gap-2 rounded-xl px-5 text-sm font-semibold shadow-md shadow-primary/20"
                  >
                    {saving ? (
                      <LoadingAnimation size="sm" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Helpers ─── */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#18181b' : '#ffffff';
}

function ShieldCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}