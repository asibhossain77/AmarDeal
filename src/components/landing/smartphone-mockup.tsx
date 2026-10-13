'use client';

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
 * crossfade wrapper. Until then, the default <HeroScreenAsset /> (the
 * designer-provided theme-aware SVG screens) is rendered when no `screen`
 * prop is given.
 *
 * ── CURRENT DEFAULT SCREEN (designer SVG assets) ────────────────────────────
 * The default screen is <HeroScreenAsset />: two designer-provided SVG files
 * that swap automatically with the site theme via pure CSS (Tailwind `dark:`
 * class variant — no JS, no reload, instant switching):
 *
 *     Light Mode → public/midman-hero-light.svg
 *     Dark Mode  → public/midman-hero-dark.svg
 *
 * To replace either screen later, simply overwrite the corresponding file in
 * public/ (keep the filename) — no code changes needed. The two assets are
 * fully independent of each other.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type SmartphoneMockupProps = {
  /** Screen content rendered inside the display. Defaults to <HeroScreenAsset /> (theme-aware SVG screens). */
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
          {screen ?? <HeroScreenAsset />}
        </div>
      </div>
    </div>
  );
}

/**
 * HeroScreenAsset — the hero phone's default screen content.
 *
 * Renders the two designer-provided SVG screens (kept as separate, swappable
 * files in public/) and picks one purely with CSS via the existing theme
 * system (Tailwind `dark:` class variant on <html> — the same mechanism the
 * rest of the site uses, no duplicate theme logic):
 *
 *   - public/midman-hero-light.svg → shown in Light Mode
 *   - public/midman-hero-dark.svg  → shown in Dark Mode
 *
 * Both <img> layers stay mounted, so toggling the site theme swaps the screen
 * instantly — no reload, no flash, and both assets are pre-warmed in cache.
 * The SVGs keep their intrinsic aspect ratio via object-cover (centered,
 * edge-to-edge fill of the screen container; the container's overflow-hidden
 * + rounded corners clip the artwork to the phone's screen shape). No
 * stretching, no whitespace bands, no overflow.
 *
 * The files are rendered with a plain <img> (not next/image) so the original
 * SVG artwork is served byte-for-byte untouched — matching the project's
 * existing pattern for static SVG assets.
 */
function HeroScreenAsset() {
  return (
    <>
      {/* Light Mode screen — visible unless the .dark theme class is active */}
      <img
        src="/midman-hero-light.svg"
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-center dark:hidden"
      />
      {/* Dark Mode screen — visible only when the .dark theme class is active */}
      <img
        src="/midman-hero-dark.svg"
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-center hidden dark:block"
      />
    </>
  );
}
