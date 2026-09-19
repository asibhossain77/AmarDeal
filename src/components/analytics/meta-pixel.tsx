'use client';

/**
 * Meta Pixel — base code + PageView routing.
 *
 * Rendered once in the root layout (with the CSP nonce). Active by default
 * via DEFAULT_META_PIXEL_ID (src/lib/meta-pixel-id.ts); the
 * NEXT_PUBLIC_META_PIXEL_ID env var overrides when set. There must be
 * exactly ONE pixel on the site — do not add another fbq('init') anywhere.
 *
 * PageView coverage: the site is a Zustand-driven SPA whose views sync to
 * the URL via lib/url-sync — Next's usePathname does NOT reliably see those
 * changes (and Next's patched history makes the pathname update at an
 * unpredictable moment AFTER the view changes, which double-fires naive
 * view+pathname trackers). The stable page identity is therefore the store
 * composite: view + detail ids (product / auction / seller / download),
 * which url-sync sets atomically. The initial PageView is fired INLINE in the
 * base code (parse time — Meta's own snippet pattern, zero hydration
 * dependency); the tracker anchors on mount and fires only on subsequent
 * composite-key changes, so the first load produces exactly one PageView.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { DEFAULT_META_PIXEL_ID } from '@/lib/meta-pixel-id';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || DEFAULT_META_PIXEL_ID;

const BASE_CODE = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');
`;

/** fbclid landing param → _fbc cookie (Conversions API also reads it server-side) */
function captureFbclid(): void {
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (!fbclid) return;
    if (document.cookie.split(';').some((c) => c.trim().startsWith('_fbc='))) return;
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    const maxAge = 90 * 24 * 60 * 60;
    document.cookie = `_fbc=${fbc};max-age=${maxAge};path=/`;
  } catch {
    /* never break the page for analytics */
  }
}

/** Composite key identifying the current logical page (SPA-safe) */
function selectPageKey(s: {
  view: string;
  productDetailId: string | null;
  auctionDetailId: string | null;
  sellerProfileId: string | null;
  downloadProductId: string | null;
}): string {
  return [s.view, s.productDetailId, s.auctionDetailId, s.sellerProfileId, s.downloadProductId].join('|');
}

export function MetaPixel({ nonce }: { nonce?: string }) {
  const pageKey = useAppStore(selectPageKey);
  const lastTrackedRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    captureFbclid();
  }, []);

  useEffect(() => {
    // First run: anchor only — the initial PageView was already fired inline
    // by the base code above (parse time). Firing here too would double-count.
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastTrackedRef.current = pageKey;
      return;
    }
    if (lastTrackedRef.current === pageKey) return;
    lastTrackedRef.current = pageKey;
    try {
      window.fbq?.('track', 'PageView');
    } catch {
      /* ignore */
    }
  }, [pageKey]);

  if (!PIXEL_ID) return null;

  return (
    <>
      {/* Plain SSR'd inline script (NOT next/script): executes at HTML parse
          time with the CSP nonce — independent of hydration, so the pixel
          loads even before React hydrates. The base code itself injects
          fbevents.js, which 'strict-dynamic' allows. */}
      <script
        id="meta-pixel-base"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: BASE_CODE }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
