'use client';

/**
 * Meta Pixel — client-side tracking helpers.
 *
 * Thin, safe wrappers around window.fbq (installed by <MetaPixel /> in the
 * root layout when NEXT_PUBLIC_META_PIXEL_ID is configured). All helpers are
 * no-ops when the pixel is absent, so call sites never need feature checks.
 *
 * Deduplication contract: when a browser event is paired with a Conversions
 * API (server) event, BOTH must use the SAME event_id. The InitiateCheckout
 * pair hands its id to the order-create call via sessionStorage
 * (META_IC_EVENT_ID_KEY) — new-deal-form reads + clears it.
 */

declare global {
  interface Window {
    fbq?: {
      (command: 'track' | 'init' | 'consent' | 'revoke', ...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[][];
      loaded: boolean;
      version: string;
      push: (...args: unknown[]) => void;
    };
  }
}

/** sessionStorage key carrying the browser InitiateCheckout event_id → server */
export const META_IC_EVENT_ID_KEY = 'midman_meta_ic_event_id';

/** Generate a reasonably unique, Meta-safe event id */
export function genMetaEventId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Fire a browser Pixel event. `eventId` should be shared with the matching
 * server-side CAPI event (if any) so Meta deduplicates instead of double
 * counting.
 */
export function fbqTrack(
  eventName: string,
  data?: Record<string, unknown>,
  eventId?: string
): void {
  try {
    if (typeof window === 'undefined') return;
    if (!window.fbq) return;
    if (eventId) window.fbq('track', eventName, data ?? {}, { eventID: eventId });
    else window.fbq('track', eventName, data ?? {});
  } catch {
    /* analytics must never break the UI */
  }
}

/** Read-and-clear the pending InitiateCheckout event id (browser → server handoff) */
export function takeMetaIcEventId(): string | undefined {
  try {
    const id = sessionStorage.getItem(META_IC_EVENT_ID_KEY) ?? undefined;
    if (id) sessionStorage.removeItem(META_IC_EVENT_ID_KEY);
    return id;
  } catch {
    return undefined;
  }
}
