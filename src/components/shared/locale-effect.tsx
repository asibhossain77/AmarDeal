'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * Client-side effect that syncs the <html lang> attribute with the
 * current locale from the Zustand store.  Rendered once inside the
 * ThemeProvider so it runs after hydration.
 */
export function LocaleEffect() {
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    const saved = localStorage.getItem('midman-locale');
    const resolved = saved === 'en' ? 'en' : 'bn';
    document.documentElement.lang = resolved;
  }, [locale]);

  return null;
}