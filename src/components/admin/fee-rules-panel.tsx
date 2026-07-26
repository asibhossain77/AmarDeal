'use client';
import { useT } from '@/lib/i18n';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';

const emptySubscribe = () => () => {};

interface FeeRule {
  id: number;
  minimum_amount: number;
  maximum_amount: number;
  fee: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─── Form Sub-component ─── */
function FeeRuleForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: FeeRule;
  onSave: (data: { minimum_amount: number; maximum_amount: number; fee: number }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [minAmount, setMinAmount] = useState(initial?.minimum_amount?.toString() || '');
  const [maxAmount, setMaxAmount] = useState(initial?.maximum_amount?.toString() || '0');
  const [fee, setFee] = useState(initial?.fee?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const min = parseInt(minAmount, 10);
    const max = parseInt(maxAmount, 10);
    const feeVal = parseInt(fee, 10);

    if (isNaN(min) || isNaN(feeVal)) {
      toast.error('সর্বনিম্ন পরিমাণ এবং ফি সঠিকভাবে পূরণ করুন');
      return;
    }
    if (isNaN(max)) {
      toast.error('সর্বোচ্চ পরিমাণ সঠিকভাবে পূরণ করুন (0 = সীমাহীন)');
      return;
    }
    if (min < 0 || (max !== 0 && max < 0) || feeVal < 0) {
      toast.error('নেগেটিভ মান গ্রহণযোগ্য নয়');
      return;
    }
    if (max !== 0 && max <= min) {
      toast.error('সর্বোচ্চ পরিমাণ সর্বনিম্ন পরিমাণের চেয়ে বড় হতে হবে');
      return;
    }

    onSave({ minimum_amount: min, maximum_amount: max, fee: feeVal });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            সর্বনিম্ন পরিমাণ (৳)
          </Label>
          <Input
            type="number"
            min="0"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="যেমন: 500"
            className="rounded-xl"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            সর্বোচ্চ পরিমাণ (৳) — <span className="text-primary">0 = সীমাহীন</span>
          </Label>
          <Input
            type="number"
            min="0"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="0 = সীমাহীন"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            ফি (৳)
          </Label>
          <Input
            type="number"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="যেমন: 30"
            className="rounded-xl"
            required
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={loading}
          className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? 'আপডেট করুন' : 'যোগ করুন'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="gap-2 rounded-xl"
        >
          <X className="h-4 w-4" />
          বাতিল
        </Button>
      </div>
    </form>
  );
}

/* ─── Main Panel ─── */
export function FeeRulesPanel
  const t = useT();() {
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FeeRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/fee-rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchRules();
  }, [mounted, fetchRules]);

  const handleAdd = async (data: { minimum_amount: number; maximum_amount: number; fee: number }) => {
    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/fee-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'তৈরি করতে ব্যর্থ');
        return;
      }
      toast.success('ফি নিয়ম সফলভাবে যোগ হয়েছে');
      setShowForm(false);
      fetchRules();
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (data: { minimum_amount: number; maximum_amount: number; fee: number }) => {
    if (!editing) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/fee-rules/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'আপডেট করতে ব্যর্থ');
        return;
      }
      toast.success('ফি নিয়ম আপডেট হয়েছে');
      setEditing(null);
      fetchRules();
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই নিয়মটি মুছে ফেলতে চান?')) return;
    try {
      const res = await fetch(`/api/admin/fee-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('ফি নিয়ম মুছে ফেলা হয়েছে');
        fetchRules();
      } else {
        toast.error('মুছে ফেলতে ব্যর্থ');
      }
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি');
    }
  };

  const handleToggle = async (rule: FeeRule) => {
    try {
      const res = await fetch(`/api/admin/fee-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      if (res.ok) {
        toast.success(rule.is_active ? 'নিয়ম নিষ্ক্রিয় করা হয়েছে' : 'নিয়ম সক্রিয় করা হয়েছে');
        fetchRules();
      } else {
        toast.error('অবস্থা পরিবর্তন করতে ব্যর্থ');
      }
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি');
    }
  };

  const formatRange = (min: number, max: number) => {
    const minStr = `৳${min.toLocaleString('en-BD')}`;
    if (max === 0) return `${minStr} — ∞`;
    return `৳${min.toLocaleString('en-BD')} — ৳${max.toLocaleString('en-BD')}`;
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">ফি কাঠামো ম্যানেজমেন্ট</h2>
          <p className="text-sm text-muted-foreground mt-1">
            লেনদেনের পরিসর অনুযায়ী ফি নিয়ম তৈরি, সম্পাদনা ও মুছে ফেলুন
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchRules(); setLoading(true); setTimeout(() => setLoading(false), 300); }}
            className="gap-1.5 rounded-xl"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            রিফ্রেশ
          </Button>
          {!showForm && !editing && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              নতুন নিয়ম
            </Button>
          )}
        </div>
      </div>

      {/* Add / Edit Form */}
      {(showForm || editing) && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/40 p-5 shadow-lg">
          <h3 className="text-sm font-bold text-foreground mb-4">
            {editing ? 'নিয়ম সম্পাদনা করুন' : 'নতুন ফি নিয়ম যোগ করুন'}
          </h3>
          <FeeRuleForm
            key={editing?.id ?? 'new'}
            initial={editing || undefined}
            onSave={editing ? handleEdit : handleAdd}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            loading={formLoading}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Desktop Table */}
      {!loading && rules.length > 0 && (
        <div className="hidden lg:block rounded-2xl bg-white dark:bg-zinc-900 border border-border/40 shadow-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider">সীমা</th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider">ফি</th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider">অবস্থা</th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-foreground">
                      {formatRange(rule.minimum_amount, rule.maximum_amount)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge className="border-0 bg-primary/10 text-primary font-bold text-sm px-2.5 py-0.5">
                      ৳{rule.fee}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                        rule.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                      }`}
                    >
                      {rule.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {rule.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditing(rule)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        title="সম্পাদনা"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 transition-colors"
                        title="মুছুন"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards */}
      {!loading && rules.length > 0 && (
        <div className="lg:hidden space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/40 p-4 shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {formatRange(rule.minimum_amount, rule.maximum_amount)}
                  </p>
                  <Badge className="mt-1 border-0 bg-primary/10 text-primary font-bold text-sm px-2.5 py-0.5">
                    ৳{rule.fee}
                  </Badge>
                </div>
                <button
                  onClick={() => handleToggle(rule)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    rule.is_active
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                  }`}
                >
                  {rule.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {rule.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </button>
              </div>
              <div className="flex gap-2 border-t border-border/30 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(rule)}
                  className="flex-1 gap-1.5 rounded-xl text-xs"
                >
                  <Pencil className="h-3 w-3" />
                  সম্পাদনা
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(rule.id)}
                  className="flex-1 gap-1.5 rounded-xl text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                  মুছুন
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && rules.length === 0 && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/40 p-12 text-center shadow-lg">
          <p className="text-muted-foreground mb-4">কোনো ফি নিয়ম নেই</p>
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Plus className="h-4 w-4" />
            প্রথম নিয়ম যোগ করুন
          </Button>
        </div>
      )}
    </div>
  );
}