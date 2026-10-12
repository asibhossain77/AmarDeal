'use client';

import { useSiteSettings } from '@/lib/use-site-settings';
import { useAppStore } from '@/lib/store';
import { cdnUrl } from '@/lib/cdn-url';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SmartphoneMockup — reusable hero phone for the Midman landing page
 * ─────────────────────────────────────────────────────────────────────────────
 * The mockup is intentionally split into three independent layers so each can
 * evolve without touching the hero layout:
 *
 *   1. Phone frame        — hardware body: bezel, side buttons, dynamic island
 *   2. Screen container   — the display surface (clips content, theme-aware)
 *   3. Screen content     — whatever is passed via the `screen` prop
 *
 * ── HOW TO ADD THE THREE REAL SCREENS LATER ─────────────────────────────────
 * Render screen content inside the phone by passing the `screen` prop.
 * The planned screens (build each as a React component or use an image asset):
 *
 *     1. Marketplace screen   → <MarketplaceScreen />
 *     2. Admin Deal screen    → <AdminDealScreen />
 *     3. Midman Verify screen → <MidmanVerifyScreen />
 *
 * Example (from the hero):
 *
 *     <SmartphoneMockup screen={<MarketplaceScreen />} />
 *
 * The planned automatic rotation needs NO changes inside this component —
 * just cycle the `screen` prop in the hero with a short interval and a
 * crossfade wrapper. Until then, the neutral <PhoneScreenPlaceholder /> is
 * rendered when no `screen` prop is given (no fabricated app data/screenshots).
 * ─────────────────────────────────────────────────────────────────────────────
 */

type SmartphoneMockupProps = {
  /** Screen content rendered inside the display. Defaults to <PhoneScreenPlaceholder />. */
  screen?: React.ReactNode;
  /** Extra classes for the outer wrapper (sizing/positioning from the parent). */
  className?: string;
};

export function SmartphoneMockup({ screen, className = '' }: SmartphoneMockupProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Soft ambient glow behind the device — subtle in both themes */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[4rem] bg-primary/[0.08] blur-3xl sm:-inset-12 dark:bg-primary/[0.1]"
      />

      {/* ── 1) Phone frame (hardware body) ── */}
      <div className="relative rounded-[2.6rem] border border-zinc-200/90 bg-gradient-to-b from-white via-zinc-100 to-zinc-200/70 p-2 shadow-xl shadow-black/[0.07] sm:rounded-[2.9rem] sm:p-2.5 dark:border-white/[0.09] dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-900 dark:shadow-black/50">
        {/* Hardware side buttons (volume left, power right) */}
        <div aria-hidden className="absolute -left-[2.5px] top-[90px] h-9 w-[3px] rounded-l-md bg-zinc-300 dark:bg-zinc-700" />
        <div aria-hidden className="absolute -left-[2.5px] top-[136px] h-12 w-[3px] rounded-l-md bg-zinc-300 dark:bg-zinc-700" />
        <div aria-hidden className="absolute -right-[2.5px] top-[112px] h-16 w-[3px] rounded-r-md bg-zinc-300 dark:bg-zinc-700" />

        {/* ── 2) Screen container (display surface) ── */}
        <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2rem] bg-background ring-1 ring-black/[0.06] sm:rounded-[2.3rem] dark:ring-white/[0.08]">
          {/* Dynamic island */}
          <div
            aria-hidden
            className="absolute left-1/2 top-2.5 z-20 h-[20px] w-[80px] -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-black"
          />

          {/* ── 3) SCREEN CONTENT AREA ─────────────────────────────────────────
              The `screen` prop renders here. Future screens:
                1. Marketplace screen   → <MarketplaceScreen />
                2. Admin Deal screen    → <AdminDealScreen />
                3. Midman Verify screen → <MidmanVerifyScreen />
              Pass one via <SmartphoneMockup screen={...} /> in the hero.
              Nothing else in this component needs to change.               */}
          {screen ?? <PhoneScreenPlaceholder />}
        </div>
      </div>
    </div>
  );
}

/**
 * PhoneScreenPlaceholder — clean, neutral stand-in displayed inside the phone
 * until the real Marketplace / Admin Deal / Midman Verify screens are added.
 * Deliberately uses only skeleton blocks and the real Midman brand mark —
 * no fabricated app data, numbers, or screenshots.
 */
export function PhoneScreenPlaceholder() {
  const { siteName, siteNameEn, siteLogo } = useSiteSettings();
  const locale = useAppStore((s) => s.locale);
  const displayName = locale === 'en' ? siteNameEn : siteName;

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-primary/[0.05] via-transparent to-primary/[0.04] px-5 pb-3.5 pt-14 dark:from-primary/[0.07] dark:to-primary/[0.05]">
      {/* Brand mark — centered in the upper half of the screen */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5">
        {siteLogo ? (
          <img
            src={cdnUrl(siteLogo) || ''}
            alt={displayName}
            className="h-14 w-14 rounded-2xl object-contain"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            {displayName?.charAt(0) || 'M'}
          </div>
        )}
        <span className="text-sm font-bold tracking-tight text-foreground">{displayName}</span>
      </div>

      {/* Neutral skeleton blocks — intentionally unlabeled; real screens arrive later */}
      <div className="w-full space-y-2.5">
        <div className="h-2.5 w-2/3 rounded-full bg-foreground/[0.07] dark:bg-white/[0.07]" />
        <div className="h-2.5 w-1/2 rounded-full bg-foreground/[0.05] dark:bg-white/[0.05]" />
        <div className="mt-3.5 grid w-full grid-cols-2 gap-2.5">
          <div className="h-[68px] rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.05]" />
          <div className="h-[68px] rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.05]" />
          <div className="h-[68px] rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.05]" />
          <div className="h-[68px] rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.05]" />
        </div>
      </div>

      {/* Home indicator */}
      <div aria-hidden className="mt-4 h-1 w-24 shrink-0 self-center rounded-full bg-foreground/15 dark:bg-white/20" />
    </div>
  );
}
