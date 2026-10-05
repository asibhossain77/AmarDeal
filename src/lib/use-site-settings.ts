'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  DEFAULT_GATEWAYS,
  type PaymentGateway,
} from '@/lib/payment-gateways';

interface SiteSettings {
  siteName: string;
  siteNameEn: string;
  siteTitle: string;
  siteLogo: string;
  /** Admin-uploaded brand logo URLs (R2 /cdn/ paths). null ⇒ MidmanLogo falls back to the bundled brand SVGs. */
  logoLight: string | null;
  /** Admin-uploaded dark-variant logo URL. The footer always renders this variant. */
  logoDark: string | null;
  footerDescription: string;
  footerCopyrightText: string;
  footerMadeIn: string;
  /** Footer payment gateway badges (bKash/Nagad by default, admin-managed) */
  paymentGateways: PaymentGateway[];
}

const FALLBACK: SiteSettings = {
  siteName: 'মিডম্যান',
  siteNameEn: 'Midman',
  siteTitle: '',
  siteLogo: '/logo.svg',
  logoLight: null,
  logoDark: null,
  footerDescription: '',
  footerCopyrightText: '',
  footerMadeIn: '',
  paymentGateways: DEFAULT_GATEWAYS,
};

/** Old localStorage caches predate paymentGateways/logo fields — normalize on read. */
function normalize(raw: SiteSettings | null): SiteSettings | null {
  if (!raw) return null;
  return {
    ...raw,
    logoLight: raw.logoLight ?? null,
    logoDark: raw.logoDark ?? null,
    paymentGateways: raw.paymentGateways ?? DEFAULT_GATEWAYS,
  };
}

const STORAGE_KEY = 'midman-site-settings';
const CHANNEL_NAME = 'midman-site-settings';

function readFromStorage(): SiteSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw) as SiteSettings);
  } catch {
    return null;
  }
}

function writeToStorage(data: SiteSettings) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === JSON.stringify(data)) return; // unchanged — skip write
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

// Dedupe only IN-FLIGHT requests. Resolved data is deliberately NOT cached at
// module level — caching it here made every React Query refetch return the
// same frozen object, so browsers that had the page open never saw admin
// logo/settings changes (they kept showing the old/default logo).
let fetchPromise: Promise<SiteSettings> | null = null;

// Module-level query client ref for invalidation from non-hook code
let _queryClient: QueryClient | null = null;

function captureQueryClient(client: QueryClient) {
  if (!_queryClient) _queryClient = client;
}

async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!fetchPromise) {
    fetchPromise = fetch('/api/site-settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : FALLBACK))
      .catch(() => FALLBACK)
      .then((data) => {
        const normalized = normalize(data);
        writeToStorage(normalized as SiteSettings); // Persist for instant paint on next visit
        return normalized;
      })
      .finally(() => {
        fetchPromise = null; // settled — next call must hit the network again
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

  // Cross-tab instant sync: when the admin panel (another tab) updates the
  // settings, every other tab in this browser invalidates + refetches at once.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    };
    return () => channel.close();
  }, [queryClient]);

  // Read persisted settings instantly (no loading flash of old logo)
  const persisted = typeof window !== 'undefined' ? readFromStorage() : null;

  const { data } = useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: fetchSiteSettings,
    staleTime: 60 * 1000, // trust a real network fetch for 60s
    gcTime: 10 * 60 * 1000,
    // localStorage data paints instantly, but initialDataUpdatedAt: 0 marks it
    // STALE, so a background refetch runs on EVERY mount. This is what makes
    // other browsers pick up an admin logo change on their very next visit
    // (previously initialData was treated as fresh for 5 min → stale logo).
    initialData: persisted || undefined,
    initialDataUpdatedAt: persisted ? 0 : undefined,
    // Global default disables focus refetch — re-enable for settings only so
    // tabs left open also refresh when the user returns to them.
    refetchOnWindowFocus: true,
  });

  return data || persisted || FALLBACK;
}

/** Invalidate the site-settings cache (call after admin updates) */
export function invalidateSiteSettingsCache() {
  fetchPromise = null;
  // Invalidate React Query cache so this tab refetches immediately
  if (_queryClient) {
    _queryClient.invalidateQueries({ queryKey: ['site-settings'] });
  }
  // Notify all OTHER tabs in the same browser instantly
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage('site-settings-updated');
      channel.close();
    } catch {
      // ignore — other tabs still refetch on their next mount/focus
    }
  }
}
