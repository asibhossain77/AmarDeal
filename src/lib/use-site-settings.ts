'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

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

const STORAGE_KEY = 'midman-site-settings';

function readFromStorage(): SiteSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SiteSettings;
  } catch {
    return null;
  }
}

function writeToStorage(data: SiteSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

// Global cache outside React — shared across all components
let cachedSettings: SiteSettings | null = null;
let fetchPromise: Promise<SiteSettings> | null = null;

// Module-level query client ref for invalidation from non-hook code
let _queryClient: QueryClient | null = null;

function captureQueryClient(client: QueryClient) {
  if (!_queryClient) _queryClient = client;
}

async function fetchSiteSettings(): Promise<SiteSettings> {
  if (cachedSettings) return cachedSettings;
  if (!fetchPromise) {
    fetchPromise = fetch('/api/site-settings')
      .then((r) => (r.ok ? r.json() : FALLBACK))
      .catch(() => FALLBACK)
      .then((data) => {
        cachedSettings = data;
        writeToStorage(data); // Persist to localStorage for instant reload
        return data;
      });
  }
  return fetchPromise;
}

/** Hook to get dynamic site name & logo — used everywhere */
export function useSiteSettings(): SiteSettings {
  const queryClient = useQueryClient();

  // Capture query client ref after mount (for invalidateSiteSettingsCache)
  useEffect(() => {
    captureQueryClient(queryClient);
  }, [queryClient]);

  // Read persisted settings instantly (no loading flash of old logo)
  const persisted = typeof window !== 'undefined' ? readFromStorage() : null;

  const { data } = useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: fetchSiteSettings,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000,
    // Use localStorage data as initial value — logo appears instantly on reload
    initialData: persisted || undefined,
  });

  return data || persisted || FALLBACK;
}

/** Invalidate the site-settings cache (call after admin updates) */
export function invalidateSiteSettingsCache() {
  cachedSettings = null;
  fetchPromise = null;
  // Also invalidate React Query cache so components refetch immediately
  if (_queryClient) {
    _queryClient.invalidateQueries({ queryKey: ['site-settings'] });
  }
}
