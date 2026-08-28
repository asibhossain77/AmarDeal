'use client';

import { useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard, Wallet, ShieldCheck, CircleCheck } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useTranslation } from '@/lib/i18n';


const emptySubscribe = () => () => {};

/* ═══ Stagger children helper ═══ */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function EscrowStatusCard() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  const steps = [
    {
      num: locale === 'bn' ? '১' : '1',
      icon: Wallet,
      title: t('hero.step1.title'),
      subtitle: t('hero.step1.sub'),
    },
    {
      num: locale === 'bn' ? '২' : '2',
      icon: ShieldCheck,
      title: t('hero.step2.title'),
      subtitle: t('hero.step2.sub'),
    },
    {
      num: locale === 'bn' ? '৩' : '3',
      icon: CircleCheck,
      title: t('hero.step3.title'),
      subtitle: t('hero.step3.sub'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
      className="order-2 md:order-1"
    >
      <div className="relative mx-auto w-full max-w-sm md:mx-0 md:max-w-none">
        {/* Animated gradient border wrapper */}
        <div
          className="rounded-2xl p-[1.5px] animate-[rotate-border_6s_linear_infinite]"
          style={{
            background: 'conic-gradient(from var(--border-angle, 0deg), #84cc16, #a3e635, #65a30d, #bef264, #4d7c0f, #84cc16)',
          }}
        >
          {/* Glass card body */}
          <div className="card-body-glass relative overflow-hidden rounded-[14.5px] bg-white/80 p-6 backdrop-blur-xl shadow-2xl shadow-primary/[0.08] dark:bg-zinc-900/80 dark:shadow-primary/[0.04] sm:p-7">

            {/* Floating decorative blobs */}
            <div className="blob-float-1 pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/[0.08] blur-2xl dark:bg-primary/[0.05]" />
            <div className="blob-float-2 pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-primary/[0.06] blur-2xl dark:bg-primary/[0.04]" />

            {/* Inner top-left light reflection */}
            <div className="pointer-events-none absolute -inset-px rounded-[14.5px] bg-gradient-to-br from-white/60 via-transparent to-transparent dark:from-white/[0.04]" />

            {/* Card Header */}
            <div className="relative mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-bold tracking-wide text-foreground">
                  {t('hero.escrowStatus')}
                </p>
              </div>
              <span className="badge-shimmer relative overflow-hidden rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary">
                {t('hero.secured')}
              </span>
            </div>

            {/* Escrow Flow Steps */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="relative"
            >
              {/* Vertical gradient connector line */}
              <div className="absolute left-[15px] top-[14px] bottom-[44px] w-px bg-gradient-to-b from-primary/70 via-primary/25 to-transparent" />

              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.num}
                    variants={fadeUp}
                    className="relative"
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Step circle with icon */}
                      <div
                        className={`relative z-10 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-md ${
                          i === 0
                            ? 'bg-primary animate-[soft-pulse_2.5s_ease-in-out_infinite]'
                            : i === 1
                              ? 'bg-primary/80'
                              : 'bg-primary/60'
                        }`}
                      >
                        <Icon className="h-[15px] w-[15px]" strokeWidth={2.5} />
                        {/* Step number badge */}
                        <span
                          className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full bg-white text-[9px] font-black text-primary shadow-sm ring-1 ring-primary/20 dark:bg-zinc-800 dark:ring-primary/30"
                          style={{ width: 18, height: 18, fontSize: 9 }}
                        >
                          {step.num}
                        </span>
                      </div>

                      {/* Step text */}
                      <div className="min-w-0 pb-5 pt-0.5">
                        <p className="text-[13px] font-bold text-foreground">
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {step.subtitle}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Divider with glow */}
            <div className="my-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* Amount Display */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="py-4 text-center"
            >
              <div className="relative inline-flex items-baseline rounded-2xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-primary/[0.08] px-6 py-3 ring-1 ring-primary/10">
                {/* Subtle glow behind amount */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/[0.05] blur-xl" />
                <span className="relative text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                  ৳৫০,০০০
                </span>
                <span className="relative text-lg font-bold text-primary/50">
                  .০০
                </span>
              </div>
              <p className="mt-2.5 text-[11px] font-medium text-muted-foreground/80">
                {t('hero.exampleAmount')}
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const { siteName, siteNameEn } = useSiteSettings();
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const user = useAppStore((s) => s.user);
  const navigateToDashboard = useAppStore((s) => s.navigateToDashboard);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  return (
    <section className="relative overflow-hidden">
      {/* Background aura - subtle parrot green radial blur */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[120px] dark:bg-primary/[0.06]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-primary/[0.04] blur-[100px] dark:bg-primary/[0.04]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[calc(100vh-4rem)] items-center py-16 sm:py-20">
          <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Text Content Column — Right on desktop / TOP on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="order-1 flex flex-col items-center text-center md:order-2 md:items-start md:text-left"
            >
              {/* Pill Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-6 inline-flex items-center justify-center gap-2 self-center md:self-auto rounded-full bg-primary/15 px-4 py-1.5"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-primary">
                  {t('hero.badge')}
                </span>
              </motion.div>

              {/* Main Heading */}
              <h1 className="mb-5 text-center text-3xl font-bold leading-[1.2] tracking-tight sm:text-4xl md:text-left md:text-5xl lg:text-[3.4rem]">
                {t('hero.heading.line1')}
                <br />
                <span className="glow-text-lime text-primary">{t('hero.heading.highlight')}</span>
              </h1>

              {/* Subtitle */}
              <p className="mx-auto mb-8 max-w-md text-center text-base leading-relaxed text-muted-foreground md:mx-0 md:text-left sm:text-[17px]">
                {locale === 'en' ? siteNameEn : siteName}{t('hero.subtitle.prefix')}
                <br />
                {t('hero.subtitle.suffix')}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:items-start md:justify-start">
                {user ? (
                  <>
                    <Button
                      size="lg"
                      onClick={() => navigateToDashboard()}
                      className="gap-2.5 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 active:scale-[0.97] transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      {t('hero.startNow')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {locale === 'en' ? `Welcome back, ${user.name}!` : `স্বাগতম, ${user.name}!`}
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      onClick={() => useAppStore.getState().setView('auth')}
                      className="gap-2.5 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 active:scale-[0.97] transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
                    >
                      {t('hero.startNow')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <button
                      onClick={() => useAppStore.getState().setView('page-how-it-works')}
                      className="inline-flex items-center gap-1.5 rounded-xl px-7 py-3 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t('hero.learnMore')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>

            {/* Escrow Status Card Column — Left on desktop / BOTTOM on mobile */}
            <EscrowStatusCard />
          </div>
        </div>
      </div>
    </section>
  );
}
