'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { HeroIllustration } from '@/components/landing/hero-illustration';
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
 * Hero — premium, minimal two-part hero (Midman green identity).
 *
 * Left: headline (brand-green highlighted phrase), supporting description and
 * a small trust indicator. Right: lightweight inline-SVG illustration of a
 * person working on a laptop with floating security / buyers / sellers /
 * business icons. Beneath both: the four primary destination cards.
 *
 * No CTA buttons in the text area on purpose — the action cards below are the
 * primary actions (per design spec).
 */
export function Hero() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const reduce = useReducedMotion();

  // Headline split into start / highlight / end so each locale picks which
  // words get the Midman green treatment (see hero.headline.* i18n keys).
  const headStart = t('hero.headline.start');
  const highlight = t('hero.headline.highlight');
  const headEnd = t('hero.headline.end');

  // Motion props respect the user's reduced-motion preference.
  const motionProps = reduce
    ? { variants: undefined, initial: undefined, animate: undefined }
    : { initial: 'hidden' as const, animate: 'visible' as const };

  return (
    <section className="relative overflow-hidden">
      {/* ── Background treatment ──
          Light: clean white → light-mint gradient. Dark: deep charcoal-green.
          Both keep a subtle green radial glow; light mode adds a faint dot grid. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 hidden dark:block"
          style={{ background: 'linear-gradient(180deg, #0A0C0A 0%, #0D120E 100%)' }}
        />
        <div
          className="absolute inset-0 dark:hidden"
          style={{ background: 'linear-gradient(180deg, #FAFDFA 0%, #EDF7EF 100%)' }}
        />
        {/* Soft green radial glows */}
        <div className="absolute left-1/2 top-[-140px] h-[420px] w-[720px] max-w-[120vw] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px] dark:bg-primary/[0.09]" />
        <div className="absolute right-[-160px] top-[180px] h-[380px] w-[380px] rounded-full bg-[#14B8A6]/[0.06] blur-[110px] dark:bg-[#14B8A6]/[0.07]" />
        {/* Faint dot grid (light mode only) */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:hidden"
          style={{
            backgroundImage: 'radial-gradient(circle, oklch(0.768 0.189 131) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Main hero: text left · illustration right (stacked on mobile) ── */}
        <div className="grid items-center gap-10 pb-2 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pt-16">
          {/* Left: headline + description + trust indicator */}
          <motion.div
            {...motionProps}
            variants={stagger}
            className="flex flex-col items-center text-center lg:items-start lg:text-left"
          >
            <motion.h1
              variants={fadeUp}
              className="max-w-xl font-display text-[2.05rem] font-bold leading-[1.22] tracking-tight text-foreground sm:text-5xl sm:leading-[1.18] lg:text-[3.3rem]"
            >
              {headStart}
              <br />
              <span className="text-primary">{highlight}</span>
              {headEnd}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-[17px]"
            >
              {t('hero.subtitle')}
            </motion.p>

            {/* Small trust indicator */}
            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm sm:text-[13px]">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                {t('hero.trust.escrow')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm sm:text-[13px]">
                <BadgeCheck className="h-4 w-4 text-primary" aria-hidden />
                {t('hero.trust.verified')}
              </span>
            </motion.div>
          </motion.div>

          {/* Right: illustration (fixed viewBox SVG → no layout shift) */}
          <motion.div
            {...motionProps}
            variants={fadeUp}
            className="mx-auto flex w-full max-w-[300px] justify-center sm:max-w-[380px] lg:max-w-[460px] xl:max-w-[500px]"
          >
            <HeroIllustration />
          </motion.div>
        </div>

        {/* ── Four primary destination cards ── */}
        <HeroActionCards />
      </div>
    </section>
  );
}
