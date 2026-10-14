'use client';

import { motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, FilePlus, ShieldCheck, Store } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { SmartphoneMockup } from '@/components/landing/smartphone-mockup';
import { HeroScreenRotation } from '@/components/landing/hero-screen-rotation';

// Entrance animations (subtle, premium fintech feel)
// ease is typed as a cubic-bezier tuple to satisfy framer-motion's Easing type
const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const phoneIn: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.65, delay: 0.2, ease: EASE },
  },
};

export function Hero() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  // Headline split into start / highlight / end so each locale picks which
  // words get the Midman green treatment (see hero.headline.* i18n keys).
  const headStart = t('hero.headline.start');
  const highlight = t('hero.headline.highlight');
  const headEnd = t('hero.headline.end');

  // Admin Deal CTA — logged-in users go straight to deal creation,
  // visitors to the auth view (existing workflow, unchanged).
  const handleAdminDeal = () => {
    const store = useAppStore.getState();
    if (store.user) {
      store.setView('dashboard');
      store.setDashboardPanel('new-deal');
    } else {
      store.setView('auth');
    }
  };

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
          style={{ background: 'linear-gradient(180deg, #F8FCF8 0%, #EAF8EF 100%)' }}
        />
        {/* Subtle green radial glow */}
        <div className="absolute left-1/2 top-[-140px] h-[420px] w-[720px] max-w-[120vw] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px] dark:bg-primary/[0.09]" />
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
        <div className="flex min-h-[calc(100vh-4rem)] items-center py-10 sm:py-14 lg:py-20">
          <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
            {/* ── Right column (desktop) / first on mobile: hero content ── */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="order-1 flex flex-col items-center text-center lg:order-2 lg:items-start lg:text-left"
            >
              {/* Headline */}
              <h1 className="max-w-xl text-3xl font-bold leading-[1.25] tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem] xl:text-5xl">
                {headStart} <span className="text-primary">{highlight}</span>
                {headEnd}
              </h1>

              {/* Supporting description */}
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground lg:text-[17px]">
                {t('hero.subtitle')}
              </p>

              {/* CTA buttons */}
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start"
              >
                {/* Primary — Midman Brand Verify (external) */}
                <motion.div variants={fadeUp} className="w-full sm:w-auto">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 gap-2.5 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97]"
                  >
                    <a
                      href="https://verify.midman.bd"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ShieldCheck className="h-5 w-5" />
                      {t('hero.cta.verify')}
                    </a>
                  </Button>
                </motion.div>

                {/* Secondary — Marketplace (existing route) */}
                <motion.div variants={fadeUp} className="w-full sm:w-auto">
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-12 gap-2 rounded-xl border-border/70 bg-background/60 px-6 text-[15px] font-medium backdrop-blur-sm transition-colors duration-200 hover:border-primary/40 hover:text-primary"
                  >
                    <a
                      href="/marketplace"
                      onClick={(e) => {
                        e.preventDefault();
                        useAppStore.getState().setView('page-marketplace');
                      }}
                    >
                      <Store className="h-5 w-5" />
                      {t('hero.cta.marketplace')}
                    </a>
                  </Button>
                </motion.div>

                {/* Secondary — Admin Deal (auth-aware: user → dashboard new-deal, guest → login) */}
                <motion.div variants={fadeUp} className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleAdminDeal}
                    className="h-12 gap-2 rounded-xl border-border/70 bg-background/60 px-6 text-[15px] font-medium backdrop-blur-sm transition-colors duration-200 hover:border-primary/40 hover:text-primary"
                  >
                    <FilePlus className="h-5 w-5" />
                    {t('hero.cta.adminDeal')}
                    <ArrowRight className="h-4 w-4 opacity-60" />
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* ── Left column (desktop) / second on mobile: smartphone showcase ── */}
            <motion.div
              variants={phoneIn}
              initial="hidden"
              animate="visible"
              className="order-2 flex justify-center lg:order-1"
            >
              {/* EDITABLE SCREEN: rotates Marketplace ↔ Admin Deal (designer
                  SVGs, theme-aware) every 4.5s with a subtle crossfade —
                  see hero-screen-rotation.tsx. The frame itself stays static. */}
              <SmartphoneMockup
                screen={<HeroScreenRotation />}
                className="w-full max-w-[250px] sm:max-w-[280px] lg:max-w-[310px] xl:max-w-[340px]"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
