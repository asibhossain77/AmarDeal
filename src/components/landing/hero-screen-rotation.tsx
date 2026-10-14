'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * HeroScreenRotation — automatic two-screen rotation for the hero phone
 * ─────────────────────────────────────────────────────────────────────────────
 * Owns three independent concerns, each kept separate from the phone frame
 * (SmartphoneMockup stays a dumb frame — this component is passed to it via
 * the `screen` prop from the hero):
 *
 *   1. Screen selection   — a timer cycles the active screen every 4.5s.
 *   2. Theme selection    — pure CSS via the existing site theme system
 *                           (Tailwind `dark:` class variant on <html>), so a
 *                           theme change instantly repaints the currently
 *                           active screen with the matching SVG. No JS theme
 *                           logic, no duplicate theme management.
 *   3. Transition         — a short opacity crossfade (~700ms).
 *
 * ── SCREEN → ASSET MAPPING ───────────────────────────────────────────────────
 * Each screen type maps to its own pair of designer-provided SVG files
 * (byte-for-byte originals, kept independent so either can be replaced later
 * by overwriting the file in public/ — no code change needed):
 *
 *     Marketplace → public/midman-hero-light.svg        (Light Mode)
 *                   public/midman-hero-dark.svg         (Dark Mode)
 *     Admin Deal  → public/midman-admin-deal-light.svg  (Light Mode)
 *                   public/midman-admin-deal-dark.svg   (Dark Mode)
 *
 * To add the future Midman Verify screen: drop the two SVGs into public/
 * following the same naming pattern and append one entry to HERO_SCREENS —
 * the rotation picks it up automatically. (Intentionally NOT added yet.)
 *
 * ── CROSSFADE TECHNIQUE (fade-out-over, no background dip) ───────────────────
 * All screen layers stay mounted and absolutely stacked inside the screen
 * container (fixed aspect ratio → zero layout shift). The incoming layer
 * becomes fully opaque instantly UNDERNEATH, while the outgoing layer
 * (z-above) fades from 1 → 0 on top of it. The screen background can never
 * bleed through mid-fade. Exactly one screen is visible before and after
 * each transition; the phone frame itself never moves.
 *
 * ── REDUCED MOTION ───────────────────────────────────────────────────────────
 * When the user prefers reduced motion, the fade transition is disabled via
 * `motion-reduce:transition-none` (pure CSS) — the rotation then swaps screens
 * with an instant, motion-free cut. No JS detection, no duplicated logic.
 *
 * ── LIFECYCLE ────────────────────────────────────────────────────────────────
 * The interval is created inside useEffect and cleared on unmount, so no
 * timers or animation resources leak. The initial state (Marketplace active,
 * nothing leaving) is deterministic on server and client → no hydration
 * mismatch. All four SVGs are mounted from the start, pre-warming the cache
 * so crossfades never pop.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';

/** One screen type = one pair of theme-specific, independently swappable assets. */
const HERO_SCREENS = [
  {
    id: 'marketplace',
    assets: {
      light: '/midman-hero-light.svg',
      dark: '/midman-hero-dark.svg',
    },
  },
  {
    id: 'admin-deal',
    assets: {
      light: '/midman-admin-deal-light.svg',
      dark: '/midman-admin-deal-dark.svg',
    },
  },
  // Midman Verify intentionally not added yet — two screens for now.
] as const;

/** How often the screen rotates (4–5s window requested → 4.5s). */
const ROTATE_EVERY_MS = 4500;

/** Crossfade duration; must match the `duration-700` class below. */
const FADE_DURATION_CLASS = 'duration-700';

type RotationState = {
  /** Index of the currently visible screen. */
  current: number;
  /** Index of the screen fading out on top (null before the first rotation). */
  previous: number | null;
};

export function HeroScreenRotation() {
  const [rotation, setRotation] = useState<RotationState>({
    current: 0,
    previous: null,
  });

  // Screen selection timer — one atomic state update per tick; cleared on
  // unmount so nothing leaks.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRotation((state) => ({
        current: (state.current + 1) % HERO_SCREENS.length,
        previous: state.current,
      }));
    }, ROTATE_EVERY_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      {HERO_SCREENS.map((screen, i) => {
        const isActive = i === rotation.current;
        // The outgoing screen fades out on top of the (already opaque)
        // incoming one — a true crossfade with no background bleed-through.
        const isLeaving = !isActive && i === rotation.previous;

        const layerClass = isActive
          ? // Active screen: fully opaque immediately (no transition, so a
            // returning screen snaps to opaque under the fading-out layer).
            'absolute inset-0 z-0 opacity-100'
          : isLeaving
            ? `pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity ${FADE_DURATION_CLASS} ease-in-out motion-reduce:transition-none`
            : 'pointer-events-none absolute inset-0 z-0 opacity-0';

        return (
          // Decorative artwork — hidden from the a11y tree, same as before.
          <div key={screen.id} aria-hidden className={layerClass}>
            {/* Light Mode SVG — visible unless the .dark theme class is active */}
            <img
              src={screen.assets.light}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-center dark:hidden"
            />
            {/* Dark Mode SVG — visible only when the .dark theme class is active */}
            <img
              src={screen.assets.dark}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-center hidden dark:block"
            />
          </div>
        );
      })}
    </>
  );
}
