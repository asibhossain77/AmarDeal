'use client';

import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/locales/bn';

export interface OptionRow {
  id: string;
  name: string;
  price: string;
  isAvailable: boolean;
}

interface ProductOptionsEditorProps {
  options: OptionRow[];
  onChange: (rows: OptionRow[]) => void;
  /** Client-side duplicate name check is always on; pass false to allow reordering UI only */
  showRangePreview?: boolean;
}

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createEmptyOption(): OptionRow {
  return { id: makeId(), name: '', price: '', isAvailable: true };
}

// Client-side validation mirroring the server rules.
// Returns null when valid, otherwise a translation-ready error key.
export function validateOptionRows(rows: OptionRow[]): TranslationKey | null {
  if (rows.length === 0) return 'seller.optionMinOne';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.name.trim()) return 'seller.optionNameRequired';
    const price = Number(row.price);
    if (!row.price.trim() || Number.isNaN(price) || price <= 0) return 'seller.optionPriceInvalid';
    const key = row.name.trim().toLowerCase();
    if (seen.has(key)) return 'seller.optionDuplicate';
    seen.add(key);
  }
  return null;
}

export function optionRowsToPayload(rows: OptionRow[]) {
  return rows.map((r, i) => ({
    name: r.name.trim(),
    price: Number(r.price),
    isAvailable: r.isAvailable,
    sortOrder: i,
  }));
}

// Editor used by both the seller dashboard Add/Edit Product panels and the
// marketplace Add Product dialog. Mobile-first: rows stack vertically.
export function ProductOptionsEditor({ options, onChange, showRangePreview = true }: ProductOptionsEditorProps) {
  const t = useT();

  const update = (id: string, patch: Partial<OptionRow>) => {
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const remove = (id: string) => {
    onChange(options.filter((o) => o.id !== id));
  };

  const add = () => {
    onChange([...options, createEmptyOption()]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    onChange(next);
  };

  const prices = options.map((o) => Number(o.price)).filter((n) => Number.isFinite(n) && n > 0);
  const hasRange = prices.length > 1 && Math.min(...prices) !== Math.max(...prices);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <label className="text-sm font-semibold text-foreground">{t('seller.productOptions')}</label>
        {showRangePreview && hasRange && (
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('seller.priceRange')}: <span className="font-bold text-primary">৳{Math.min(...prices).toLocaleString('en')} – ৳{Math.max(...prices).toLocaleString('en')}</span>
          </span>
        )}
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{t('seller.productOptionsDesc')}</p>

      <div className="space-y-3">
        {options.map((row, i) => (
          <div
            key={row.id}
            className="rounded-xl border border-border/50 bg-muted/20 p-3 dark:border-border/30"
          >
            {/* Row header: index + reorder + remove */}
            <div className="mb-2 flex items-center justify-between">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={t('seller.moveUp')}
                  title={t('seller.moveUp')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === options.length - 1}
                  aria-label={t('seller.moveDown')}
                  title={t('seller.moveDown')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  aria-label="remove option"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Name + price: stacked on mobile, side by side on desktop */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">{t('seller.optionName')}</label>
                <Input
                  value={row.name}
                  onChange={(e) => update(row.id, { name: e.target.value })}
                  placeholder={t('seller.optionNamePh')}
                  className="h-10 rounded-lg"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">{t('seller.optionPrice')}</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={row.price}
                  onChange={(e) => update(row.id, { price: e.target.value })}
                  placeholder="500"
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            {/* Availability toggle */}
            <div className="mt-2.5 flex items-center justify-between">
              <span className={`text-[11px] font-medium ${row.isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
                {row.isAvailable ? t('seller.optionAvailable') : t('seller.optionUnavailable')}
              </span>
              <Switch
                checked={row.isAvailable}
                onCheckedChange={(checked) => update(row.id, { isAvailable: checked })}
                aria-label={t('seller.optionAvailable')}
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={add}
        className="w-full gap-2 rounded-xl border-dashed text-[13px] font-semibold text-primary hover:bg-primary/5"
      >
        <Plus className="h-4 w-4" />
        {t('seller.addOption')}
      </Button>
    </div>
  );
}
