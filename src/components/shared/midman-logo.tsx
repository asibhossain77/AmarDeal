'use client';

import { useSiteSettings } from '@/lib/use-site-settings';

/**
 * MidmanLogo — the single brand logo used across the entire website.
 *
 * Sources (admin-managed via Admin Panel → Website Settings → Logo Settings):
 *   - logoLight → PlatformSetting `site_logo_light` (light theme surfaces)
 *   - logoDark  → PlatformSetting `site_logo_dark`  (dark theme surfaces)
 * Values arrive through useSiteSettings() (/api/site-settings + localStorage
 * cache). When the admin has NOT uploaded a custom logo, the bundled official
 * Midman brand SVGs below are used — the site works normally with zero config.
 *
 * Each SVG is a complete branding element (icon + "Midman" wordmark) with its
 * own opaque background, so NO extra site-name text may be rendered beside it.
 * The FOOTER always renders the dark variant (forceDark) — its background is
 * permanently dark, so no separate footer upload exists.
 *
 * Theme switching is done purely with CSS `dark:` variants (next-themes class
 * strategy), so the correct variant is chosen before first paint — no hydration
 * mismatch, no flash of the wrong logo. Both <img> elements are rendered and
 * CSS toggles visibility; using <img> (instead of inlining) keeps each SVG in
 * its own document, which avoids duplicate clip-path id collisions when the
 * logo appears multiple times on one page. SVGs keep their original aspect
 * ratio (width auto-derives from the height class) and are never converted
 * to PNG/JPG.
 */

/** Bundled fallbacks — also imported by the Admin Panel preview cards. */
export const DEFAULT_LOGO_LIGHT = '/brand/midman-light.svg';
export const DEFAULT_LOGO_DARK = '/brand/midman-dark.svg';

interface MidmanLogoProps {
  /** Height + any extra classes (rounding/shadow). Width auto-derives from the SVG's aspect ratio. */
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
  const { logoLight, logoDark } = useSiteSettings();
  const lightSrc = logoLight || DEFAULT_LOGO_LIGHT;
  const darkSrc = logoDark || DEFAULT_LOGO_DARK;
  const fetchPriorityProp = priority ? ('high' as const) : undefined;

  if (forceDark) {
    return (
      <img
        src={darkSrc}
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
        src={lightSrc}
        alt={alt}
        fetchPriority={fetchPriorityProp}
        decoding="async"
        className={`w-auto object-contain dark:hidden ${className}`}
      />
      {/* Dark theme variant (hidden from the accessibility tree while display:none) */}
      <img
        src={darkSrc}
        alt={alt}
        aria-hidden
        fetchPriority={fetchPriorityProp}
        decoding="async"
        className={`hidden w-auto object-contain dark:block ${className}`}
      />
    </>
  );
}
