'use client';

import { useEffect, useRef } from 'react';

/**
 * LoadingScreen — premium minimal boot loader for Midman.
 *
 * Exactly two visual elements on a themed full-screen overlay:
 *   1. the original Midman SVG mark (public/loading-logo.svg, served
 *      byte-for-byte as provided — never recoloured or modified), and
 *   2. a slim animated green progress bar beneath it.
 *
 * ── Behaviour contract ──────────────────────────────────────────────────
 * • Shows with the FIRST server-rendered paint (SSR HTML — no white flash,
 *   no hydration dependency for the show path). `bg-background` keeps it
 *   seamlessly identical to the page background in light AND dark mode, so
 *   the fade-out reveals the site without any tone jump.
 * • Hidden once the browser `load` event confirms initial resources are
 *   ready (plus one frame for a stable paint), with a small 450ms minimum
 *   so the mark registers instead of strobing. No artificial delays.
 * • Session-once: an inline pre-paint script (CSP-nonce'd like MetaPixel)
 *   sets data-mm-booted from sessionStorage BEFORE first paint, so the
 *   overlay never flashes again on reloads/back-forward in the same
 *   session. Client-side (SPA) navigation never remounts the root layout,
 *   so internal navigation can never show it either.
 * • Never traps the user:
 *     - JS hard cap ~2.8s after hydration,
 *     - pure-CSS exit animation ~2.4s after first paint as the final
 *       failsafe if hydration never happens at all,
 *     - any window error hides it immediately.
 * • Implementation note: deliberately ZERO React state — the fade is done
 *   by toggling a CSS class on the node (external-system sync), so the
 *   overlay causes no re-renders and cannot delay app initialization.
 * • prefers-reduced-motion: the sliding bar becomes static; the exits stay
 *   opacity-only fades (not motion).
 * ────────────────────────────────────────────────────────────────────────
 */

const BOOT_FLAG = 'mm-booted';
const ATTR = 'data-mm-booted';

export function LoadingScreen({ nonce }: { nonce?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Repeat visit in this session — the pre-paint script already hid the
    // overlay (display:none) before it could paint; nothing to drive.
    if (document.documentElement.hasAttribute(ATTR)) return;

    const el = rootRef.current;
    if (!el) return;

    let done = false;
    const timers: number[] = [];

    const hide = () => {
      if (done) return;
      done = true;
      // 300ms opacity-only fade, then hide for good via the html attribute
      // (display:none — also marks the session so it never shows again).
      el.classList.add('mm-loader-fading');
      timers.push(
        window.setTimeout(() => {
          document.documentElement.setAttribute(ATTR, '');
          try {
            sessionStorage.setItem(BOOT_FLAG, '1');
          } catch {
            /* private mode — flag is best-effort only */
          }
        }, 320),
      );
    };

    // Ready signal: browser finished loading all initial resources.
    const MIN_DISPLAY_MS = 450;
    const schedule = () => {
      const wait = Math.max(0, MIN_DISPLAY_MS - performance.now());
      timers.push(window.setTimeout(hide, wait));
    };

    if (document.readyState === 'complete') {
      // Hydration finished after `load` — wait one double-rAF so the first
      // stable frame is committed before revealing the site.
      requestAnimationFrame(() => requestAnimationFrame(schedule));
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    // Failsafes — a stuck resource or a hydration error must never trap
    // anyone behind the overlay.
    timers.push(window.setTimeout(hide, 2800));
    window.addEventListener('error', hide);

    return () => {
      done = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('load', schedule);
      window.removeEventListener('error', hide);
    };
  }, []);

  return (
    <>
      {/* Pre-paint session guard: runs during HTML parse, BEFORE the overlay
          can paint, so repeat visits in the same session never flash it.
          Needs the CSP nonce exactly like the other inline scripts.
          suppressHydrationWarning mirrors MetaPixel/next-themes: the nonce
          exists only in the server HTML (CSP reads it at parse time); React's
          client render drops it, which is cosmetic — not a real mismatch. */}
      <script
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("${BOOT_FLAG}"))document.documentElement.setAttribute("${ATTR}","")}catch(e){}`,
        }}
      />
      <div
        ref={rootRef}
        role="status"
        className="mm-loader fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      >
        {/* Screen-reader-only — nothing visual beyond logo + bar */}
        <span className="sr-only">Loading</span>

        {/* Original Midman mark — exact provided file, unmodified.
            w-24 (96px) mobile / sm:w-28 (112px) desktop; the mark occupies
            ~90% of the square canvas → ~100px visible on desktop. */}
        <img
          src="/loading-logo.svg"
          alt=""
          width={112}
          height={112}
          draggable={false}
          className="h-auto w-24 select-none sm:w-28"
        />

        {/* Slim indeterminate progress bar — brand green gradient
            (vibrant --primary → deep --primary-foreground) */}
        <div
          aria-hidden="true"
          className="mt-7 h-[3px] w-40 overflow-hidden rounded-full bg-primary/10 sm:w-44"
        >
          <div className="mm-loader-bar h-full w-[45%] rounded-full bg-gradient-to-r from-primary to-primary-foreground" />
        </div>
      </div>
    </>
  );
}
