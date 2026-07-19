'use client';

import { useMemo } from 'react';
import { bn, type TranslationKey } from './locales/bn';
import { en } from './locales/en';

export type Locale = 'bn' | 'en';

const translations: Record<Locale, Record<TranslationKey, string>> = { bn, en };

/**
 * useTranslation — returns a `t()` function bound to the given locale.
 *
 * @param locale - 'bn' | 'en'
 * @returns t(key, vars?) — if vars provided, `{key}` tokens in the string are replaced
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   <span>{t('nav.dashboard')}</span>
 *   <span>{t('auth.resendWithTimer', { timer: '45' })}</span>
 */
export function useTranslation(locale: Locale) {
  const dict = translations[locale];

  const t = useMemo(() => {
    return (key: TranslationKey, vars?: Record<string, string | number>): string => {
      let str = dict[key] ?? bn[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    };
  }, [dict]);

  return { t, locale };
}

/** Quick access to the translation keys type for adding new keys */
export type { TranslationKey };