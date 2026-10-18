'use client';

/**
 * Item type selector (Task 82) — the FIRST step of Add Product.
 *
 * Two selectable cards matching the existing ProductTypeSelector design:
 *   - Physical Product  → tangible item: stock, optional condition and
 *     delivery info; buyers get Order Now + Admin Deal on the details page.
 *   - Non-Physical      → every product type Midman already supported
 *     (digital file / service). Buyers get Admin Deal + Message.
 *
 * Starts with NO selection — the seller must choose explicitly; the form
 * blocks submission until a type is picked. The choice decides which
 * fields render below (pricing packages / digital file for non-physical,
 * stock + condition + shipping for physical).
 */

import { Truck, Cloud } from 'lucide-react';
import { useT } from '@/lib/i18n';

export type ItemTypeValue = '' | 'physical' | 'non_physical';

interface ItemTypeSelectorProps {
  value: ItemTypeValue;
  onChange: (value: Exclude<ItemTypeValue, ''>) => void;
  t: ReturnType<typeof useT>;
  disabled?: boolean;
}

export function ItemTypeSelector({ value, onChange, t, disabled = false }: ItemTypeSelectorProps) {
  const types: {
    key: 'physical' | 'non_physical';
    Icon: typeof Truck;
    title: string;
    desc: string;
  }[] = [
    { key: 'physical', Icon: Truck, title: t('seller.itemPhysical'), desc: t('seller.itemPhysicalDesc') },
    { key: 'non_physical', Icon: Cloud, title: t('seller.itemNonPhysical'), desc: t('seller.itemNonPhysicalDesc') },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-foreground">
        {t('seller.itemType')}
        <span className="ml-1 text-destructive">*</span>
      </label>
      <p className="-mt-1 text-xs text-muted-foreground">{t('seller.itemTypeDesc')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {types.map(({ key, Icon, title, desc }) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              aria-pressed={selected}
              className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-border bg-white hover:border-primary/40 dark:bg-muted dark:hover:border-primary/40'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-foreground'}`}>{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
              <div
                className={`ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                }`}
              >
                {selected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
