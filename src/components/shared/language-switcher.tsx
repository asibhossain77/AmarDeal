'use client';

import { useSyncExternalStore } from 'react';
import { Globe } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const emptySubscribe = () => () => {};

export function LanguageSwitcher() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const { t } = useTranslation(locale);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <button className="flex h-9 w-9 items-center justify-center rounded-lg" aria-label="Language">
        <span className="h-4 w-4" />
      </button>
    );
  }

  const isBn = locale === 'bn';
  const label = isBn ? t('lang.bn') : t('lang.en');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Switch language"
        >
          <Globe className="h-[18px] w-[18px]" />
          <span className="text-xs font-semibold hidden sm:inline">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => setLocale('bn')}
          className={isBn ? 'bg-primary/10 text-primary font-semibold' : ''}
        >
          <span className="text-base mr-2.5">🇧🇩</span>
          {t('lang.bn')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale('en')}
          className={!isBn ? 'bg-primary/10 text-primary font-semibold' : ''}
        >
          <span className="text-base mr-2.5">🇬🇧</span>
          {t('lang.en')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}