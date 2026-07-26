'use client';

import { useQuery } from '@tanstack/react-query';

interface SiteSettings {
  siteName: string;
  siteNameEn: string;
  siteLogo: string;
  footerDescription: string;
  footerCopyrightText: string;
  footerMadeIn: string;
}

const FALLBACK: SiteSettings = {
  siteName: 'মিডম্যান',
  siteNameEn: 'Midman',
  siteLogo: '/logo.png',
  footerDescription: '',
  footerCopyrightText: '',
  footerMadeIn: '',
};

// Global cache outside React — shared across all components
let cachedSettings: SiteSettings | null = null;
let fetchPromise: Promise<SiteSettings> | null = null;

async function fetchSiteSettings(): Promise<SiteSettings> {
  if (cachedSettings) return cachedSettings;
  if (!fetchPromise) {
    fetchPromise = fetch('/api/site-settings')
      .then((r) => (r.ok ? r.json() : FALLBACK))
      .catch(() => FALLBACK)
      .then((data) => {
        cachedSettings = data;
        return data;
      });
  }
  return fetchPromise;
}

/** Hook to get dynamic site name & logo — used everywhere */
export function useSiteSettings(): SiteSettings {
  const { data } = useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: fetchSiteSettings,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000,
  });

  return data || FALLBACK;
}

/** Invalidate the site-settings cache (call after admin updates) */
export function invalidateSiteSettingsCache() {
  cachedSettings = null;
  fetchPromise = null;
}