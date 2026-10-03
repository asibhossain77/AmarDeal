'use client';

/**
 * MidmanLogo — the single brand logo used across the entire website.
 *
 * Uses the official Midman brand SVG files directly (served from /public/brand/):
 *   - /brand/midman-light.svg → for light backgrounds (light theme)
 *   - /brand/midman-dark.svg  → for dark backgrounds (dark theme / footer)
 *
 * Each SVG is a complete branding element (icon + "Midman" wordmark) with its
 * own opaque background, so NO extra site-name text may be rendered beside it.
 *
 * Theme switching is done purely with CSS `dark:` variants (next-themes class
 * strategy), so the correct variant is chosen before first paint — no hydration
 * mismatch, no flash of the wrong logo. Both <img> elements are rendered and
 * CSS toggles visibility; using <img> (instead of inlining) keeps each SVG in
 * its own document, which avoids duplicate clip-path id collisions when the
 * logo appears multiple times on one page.
 */

const LIGHT_SRC = '/brand/midman-light.svg';
const DARK_SRC = '/brand/midman-dark.svg';

interface MidmanLogoProps {
  /** Height + any extra classes (rounding/shadow). Width auto-derives from the SVG's 900:367.5 aspect ratio. */
  className?: string;
  /** Alt text for accessibility. The hidden variant gets an empty alt to avoid double announcement. */
  alt?: string;
  /** Always render the dark variant (used on permanently dark surfaces, e.g. footer). */
  forceDark?: boolean;
  /** High fetch priority for above-the-fold logos (navbar LCP). */
  priority?: boolean;
}

export function MidmanLogo({
  className = 'h-9 rounded-lg',
  alt = 'Midman',
  forceDark = false,
  priority = false,
}: MidmanLogoProps) {
  const fetchPriorityProp = priority ? ('high' as const) : undefined;

  if (forceDark) {
    return (
      <img
        src={DARK_SRC}
        alt={alt}
        fetchPriority={fetchPriorityProp}
        decoding="async"
        className={`w-auto object-contain ${className}`}
      />
    );
  }

  return (
    <>
      {/* Light theme variant */}
      <img
        src={LIGHT_SRC}
        alt={alt}
        fetchPriority={fetchPriorityProp}
        decoding="async"
        className={`w-auto object-contain dark:hidden ${className}`}
      />
      {/* Dark theme variant (hidden from the accessibility tree while display:none) */}
      <img
        src={DARK_SRC}
        alt={alt}
        aria-hidden
        fetchPriority={fetchPriorityProp}
        decoding="async"
        className={`hidden w-auto object-contain dark:block ${className}`}
      />
    </>
  );
}
