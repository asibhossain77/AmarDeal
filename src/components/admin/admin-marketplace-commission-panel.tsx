'use client';

/* ═══════════════════════════════════════════════════════════════
   Phase 7 — Admin: Marketplace Commission configuration.

   Sets the commission rate (0–100%) stored in PlatformSetting
   'marketplace_commission_percent'. Changes are AUDITED and apply
   ONLY to future order completions — ledger snapshots keep history
   immutable. API access is already RBAC-restricted server-side;
   this panel is hidden from roles without the permission.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Percent, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n';

export function AdminMarketplaceCommissionPanel() {
  const t = useT();
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<{ percent: number }>({
    queryKey: ['admin-marketplace-commission'],
    queryFn: async () => {
      const r = await fetch('/api/admin/marketplace-commission');
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
  });

  useEffect(() => {
    if (data) setValue(String(data.percent));
  }, [data]);

  const save = async () => {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      toast.error(t('adminFin.commissionDesc'));
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/marketplace-commission', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent: v }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(t('adminFin.rateSaved'));
      qc.invalidateQueries({ queryKey: ['admin-marketplace-commission'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
          <Receipt className="h-5 w-5 text-primary" />{t('adminFin.commissionTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('adminFin.commissionDesc')}</p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />{t('adminFin.newRate')}
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isLoading}
              className="h-11 text-lg font-bold"
              placeholder="0"
            />
          </div>
          <div className="text-center sm:pb-1">
            <p className="text-xs text-muted-foreground">{t('adminFin.currentRate')}</p>
            <p className="text-2xl font-bold text-primary">{data ? `${data.percent}%` : '—'}</p>
          </div>
          <Button onClick={save} disabled={saving || isLoading} className="h-11">
            {saving ? '…' : t('adminFin.saveRate')}
          </Button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            0% = প্ল্যাটফর্ম কোনো কমিশন নেবে না। হার প্রতিটি অর্ডার সম্পন্ন হওয়ার মুহূর্তে লেজারে স্ন্যাপশট হয় —
            পরে হার বদলালেও পুরোনো হিসাব বদলায় না। প্রতিটি পরিবর্তন অডিট লগে সংরক্ষিত হয়।
          </span>
        </div>
      </div>
    </div>
  );
}
