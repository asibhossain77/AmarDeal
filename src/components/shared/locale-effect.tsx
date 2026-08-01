'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';

/**
 * Client-side effect that syncs the <html lang> attribute with the
 * current locale from the Zustand store.  Rendered once inside the
 * ThemeProvider so it runs after hydration.
 */
export function LocaleEffect() {
   const locale = useAppStore((s) => s.locale);
   const { siteTitle } = useSiteSettings();

  useEffect(() => {
    const saved = localStorage.getItem('midman-locale');
    const resolved = saved === 'en' ? 'en' : 'bn';
    document.documentElement.lang = resolved;
  }, [locale]);

  // Dynamically update browser tab title from site settings
  useEffect(() => {
    if (siteTitle) {
      document.title = siteTitle;
    }
  }, [siteTitle]);

  return null;
}
