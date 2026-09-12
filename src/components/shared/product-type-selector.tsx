'use client';

import { Package, Layers } from 'lucide-react';
import { useT } from '@/lib/i18n';

export type ProductTypeValue = 'single' | 'multi';

interface ProductTypeSelectorProps {
  value: ProductTypeValue;
  onChange: (value: ProductTypeValue) => void;
  t: ReturnType<typeof useT>;
  disabled?: boolean;
}

// Two selectable cards shown as the FIRST step of Add Product.
// The selected type determines which fields appear below.
export function ProductTypeSelector({ value, onChange, t, disabled = false }: ProductTypeSelectorProps) {
  const types: {
    key: ProductTypeValue;
    Icon: typeof Package;
    title: string;
    desc: string;
  }[] = [
    { key: 'single', Icon: Package, title: t('seller.typeSingle'), desc: t('seller.typeSingleDesc') },
    { key: 'multi', Icon: Layers, title: t('seller.typeMulti'), desc: t('seller.typeMultiDesc') },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-foreground">{t('seller.productType')}</label>
      <p className="-mt-1 text-xs text-muted-foreground">{t('seller.productTypeDesc')}</p>
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
                  : 'border-border bg-white hover:border-primary/40 dark:bg-zinc-800 dark:hover:border-primary/40'
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
