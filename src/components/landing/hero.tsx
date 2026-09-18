'use client';

/**
 * Hero (v2) — minimal premium fintech/escrow design.
 *
 * Layout (desktop): escrow process card LEFT · headline/CTA RIGHT
 * Layout (mobile):  content first, card below, single column.
 *
 * Colors are 100% theme-driven (bg-primary / text-primary / bg-card / muted
 * etc.) so the hero always matches the site's brand palette (--primary lime
 * #84CC16) in both light and dark modes — no hero-local color families.
 */

import { motion } from 'framer-motion';
import { Wallet, ShieldCheck, HandCoins } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

/* ── Subtle, premium entrance animations ── */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};
const cardIn = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

/* ── Escrow process steps (icons: Lucide only, no emojis) ── */
const STEPS = [
  { icon: Wallet, titleKey: 'hero2.step1Title', subKey: 'hero2.step1Sub' },
  { icon: ShieldCheck, titleKey: 'hero2.step2Title', subKey: 'hero2.step2Sub' },
  { icon: HandCoins, titleKey: 'hero2.step3Title', subKey: 'hero2.step3Sub' },
] as const;

/* Icon tiles — same idiom as navbar/how-it-works: bg-primary/10 + text-primary */
const STEP_TILE = 'bg-primary/10 text-primary';

type TKey = Parameters<ReturnType<typeof useTranslation>['t']>[0];

function EscrowProcessCard({ t }: { t: (k: TKey) => string }) {
  return (
    <motion.div variants={cardIn} className="relative w-full max-w-[400px] lg:max-w-none">
      {/* soft glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[40px] bg-primary/[0.06] blur-2xl dark:bg-primary/[0.08]"
      />

      <div className="main-card-float relative rounded-[22px] border border-border/60 bg-card p-7 shadow-[0_16px_50px_-16px_rgba(16,24,40,0.12)] motion-reduce:[animation:none] dark:shadow-black/40 sm:p-7">
        {/* ── Header row ── */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">{t('hero2.statusLabel')}</p>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/25">
            {t('hero2.secure')}
          </span>
        </div>

        {/* ── Steps ── */}
        <div className="mt-5 space-y-3" role="list">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.titleKey}
              role="listitem"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.12, duration: 0.45, ease: 'easeOut' }}
              className="flex items-center gap-3.5 rounded-[14px] bg-muted/70 p-3.5 dark:bg-white/[0.04]"
            >
              <div
                aria-hidden
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${STEP_TILE}`}
              >
                <step.icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </div>
              <div className="min-w-0">
                <p className="font-display text-[15px] font-bold leading-snug text-foreground">
                  {t(step.titleKey)}
                </p>
                <p className="truncate text-[13px] leading-snug text-muted-foreground">
                  {t(step.subKey)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Amount ── */}
        <div className="mt-6 border-t border-border/70 pt-5 dark:border-white/[0.06]">
          <p className="flex items-baseline gap-0.5 font-display text-[26px] font-extrabold leading-none tracking-tight text-foreground">
            ৳50,000
            <span className="text-[13px] font-bold text-muted-foreground">.00</span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">{t('hero2.amountCaption')}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const { t } = useTranslation(useAppStore((s) => s.locale));
  const user = useAppStore((s) => s.user);
  const navigateToDashboard = useAppStore((s) => s.navigateToDashboard);

  const startDeal = () => {
    if (user) navigateToDashboard();
    else useAppStore.getState().setView('auth');
  };
  const learnMore = () => useAppStore.getState().setView('page-how-it-works');

  return (
    <section className="relative overflow-hidden">
      {/* ── Background: subtle brand-tinted radial glows, clean center ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[8%] h-[480px] w-[480px] rounded-full bg-primary/10 blur-[130px] dark:bg-primary/[0.08]" />
        <div className="absolute bottom-[-120px] left-[4%] h-[420px] w-[420px] rounded-full bg-primary/[0.08] blur-[120px] dark:bg-primary/[0.05]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-chart-2/[0.06] blur-[110px] dark:bg-chart-2/[0.04]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[calc(100svh-4rem)] items-center py-14 lg:py-10">
          <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-10 xl:gap-16">
            {/* ── Escrow card — left on desktop, below content on mobile ── */}
            <div className="order-2 lg:order-1">
              <div className="mx-auto w-full max-w-[400px] lg:max-w-[420px]">
                <EscrowProcessCard t={t} />
              </div>
            </div>

            {/* ── Content — right on desktop, first on mobile ── */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="order-1 flex flex-col items-center text-center lg:order-2 lg:items-start lg:text-left"
            >
              {/* Badge */}
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[13px] font-bold text-primary">
                  {t('hero2.badge')}
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={fadeUp}
                className="mt-6 font-display text-[38px] font-bold leading-[1.18] tracking-tight text-foreground min-[400px]:text-[42px] sm:text-[46px] lg:text-[56px] xl:text-[62px]"
              >
                {t('hero2.headingLine1')}
                <br />
                <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                  {t('hero2.headingLine2')}
                </span>
              </motion.h1>

              {/* Description */}
              <motion.p
                variants={fadeUp}
                className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground sm:text-base"
              >
                {t('hero2.description')}
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                variants={fadeUp}
                className="mt-8 flex w-full flex-col gap-3 min-[360px]:flex-row sm:w-auto"
              >
                <button
                  onClick={startDeal}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[13px] bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-0 active:scale-[0.98] sm:flex-none"
                >
                  {t('hero2.ctaPrimary')}
                </button>
                <button
                  onClick={learnMore}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[13px] border border-border bg-card px-7 text-[15px] font-semibold text-foreground transition-all duration-200 hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] sm:flex-none dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-primary/40 dark:hover:text-primary"
                >
                  {t('hero2.ctaSecondary')}
                </button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
