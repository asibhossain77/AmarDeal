'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BadgeCheck, Headphones, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { SmartphoneMockup } from '@/components/landing/smartphone-mockup';
import { HeroPhoneScreen } from '@/components/landing/hero-phone-screen';
import { HeroActionCards } from '@/components/landing/hero-action-cards';

// Entrance animations — subtle, premium fintech feel. ease is typed as a
// cubic-bezier tuple to satisfy framer-motion's Easing type.
const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

/**
 * Hero — premium green fintech hero (phone mockup left · content right).
 *
 * COLOR POLICY: this hero uses ONLY the existing theme tokens (--background,
 * --primary, --primary-foreground, --foreground, --border…) — no hardcoded
 * hex colors — so light and dark modes always match the rest of the site.
 *
 * Desktop (lg+): realistic smartphone mockup on the LEFT (~35-40% of the hero
 * visual area) showing a miniature Midman mobile interface; headline,
 * description, the four CTA buttons (2×2 grid) and the trust row on the RIGHT.
 *
 * Mobile: single column in a fixed order — headline → description → CTA
 * buttons → phone mockup BELOW the content (never above or beside it).
 * Decorative shapes are reduced on small screens.
 *
 * Both columns stack from the same DOM order (content first) and only the
 * `order` utilities differ per breakpoint, so the mobile reading order is
 * guaranteed. All destinations and auth behaviour live in HeroActionCards.
 */
export function Hero() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const reduce = useReducedMotion();

  // Headline split into start / middle / highlight / end so each locale picks
  // which words get the Midman green treatment (see hero.headline.* i18n keys).
  const headStart = t('hero.headline.start');
  const headMiddle = t('hero.headline.middle');
  const highlight = t('hero.headline.highlight');
  const headEnd = t('hero.headline.end');

  // Motion props respect the user's reduced-motion preference.
  const motionProps = reduce
    ? { variants: undefined, initial: undefined, animate: undefined }
    : { initial: 'hidden' as const, animate: 'visible' as const };

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      {/* ── Background treatment ──
          Transparent — inherits the existing theme body background (#F2F4F7
          light / #131511 dark) so the hero is seamless with the sections
          below. Decoration is token-colored only: soft green radial glows +
          a faint dot grid (desktop, light mode). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Soft green radial glows */}
        <div className="absolute left-1/2 top-[-140px] h-[420px] w-[720px] max-w-[120vw] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px] dark:bg-primary/[0.09]" />
        <div className="absolute bottom-[-120px] left-[-180px] h-[380px] w-[380px] rounded-full bg-primary/[0.06] blur-[110px] dark:bg-primary/[0.08]" />
        {/* Faint dot grid (light mode, desktop only — reduced decoration on
            small screens per spec) */}
        <div
          className="absolute inset-0 hidden opacity-[0.035] lg:block dark:hidden"
          style={{
            backgroundImage: 'radial-gradient(circle, oklch(0.768 0.189 131) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-14 lg:px-8 lg:pb-16">
        {/* ── Phone left · content right (desktop) · content → phone (mobile) ──
            Compact vertical rhythm: the whole hero stays within a normal
            desktop viewport (phone column is the height driver). */}
        <div className="grid items-center gap-12 pt-10 sm:pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:pt-14 xl:gap-14">
          {/* ── LEFT: smartphone mockup (desktop) / below content (mobile) ── */}
          <motion.div
            {...motionProps}
            variants={fadeUp}
            className="order-2 flex justify-center lg:order-1 lg:justify-start"
          >
            <div className="relative w-full max-w-[264px] sm:max-w-[288px] lg:max-w-[310px] xl:max-w-[340px]">
              {/* Abstract curved shapes behind the phone (desktop only —
                  reduced decoration on small screens per spec) */}
              <div
                aria-hidden
                className="pointer-events-none absolute -left-24 -top-16 hidden h-[380px] w-[380px] rounded-full border border-primary/15 lg:block dark:border-primary/20"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -left-12 -top-4 hidden h-[280px] w-[280px] rounded-full border border-primary/10 lg:block dark:border-primary/15"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-14 -right-20 hidden h-[300px] w-[300px] rounded-full bg-primary/[0.09] blur-3xl lg:block dark:bg-primary/[0.12]"
              />
              {/* Floating shield badge — reinforces the verify message */}
              <div
                aria-hidden
                className="absolute -left-7 bottom-24 hidden h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-lg shadow-primary/10 lg:flex dark:border-primary/25"
              >
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>

              <SmartphoneMockup screen={<HeroPhoneScreen />} />
            </div>
          </motion.div>

          {/* ── RIGHT: headline + description + CTA grid + trust row ── */}
          <motion.div
            {...motionProps}
            variants={stagger}
            className="order-1 flex flex-col items-center text-center lg:order-2 lg:items-start lg:text-left"
          >
            <motion.h1
              variants={fadeUp}
              id="hero-heading"
              className="max-w-xl font-display text-[1.9rem] font-bold leading-[1.3] tracking-tight text-primary-foreground dark:text-foreground sm:text-4xl sm:leading-[1.26] lg:text-[2.6rem] lg:leading-[1.24] xl:text-[2.85rem]"
            >
              {headStart}
              <br />
              {headMiddle ? `${headMiddle} ` : null}
              <span className="text-primary">{highlight}</span>
              {headEnd ? (
                <>
                  <br />
                  {headEnd}
                </>
              ) : null}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base"
            >
              {t('hero.subtitle')}
            </motion.p>

            {/* Four primary CTA buttons (2×2 grid, auth-aware) */}
            <motion.div variants={fadeUp} className="mt-8 w-full max-w-md lg:max-w-none">
              <HeroActionCards />
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              variants={fadeUp}
              className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 lg:justify-start"
            >
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {t('hero.trust.escrow')}
              </span>
              <span aria-hidden className="hidden h-3.5 w-px bg-border sm:block" />
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {t('hero.trust.verified')}
              </span>
              <span aria-hidden className="hidden h-3.5 w-px bg-border sm:block" />
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                <Headphones className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {t('hero.trust.support')}
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
