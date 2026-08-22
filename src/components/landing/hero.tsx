'use client';

import { useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useTranslation } from '@/lib/i18n';
import { isLandingDomain, getAppUrl } from '@/lib/domain';

const emptySubscribe = () => () => {};

function EscrowStatusCard() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  const steps = [
    {
      num: locale === 'bn' ? '১' : '1',
      color: 'bg-primary',
      title: t('hero.step1.title'),
      subtitle: t('hero.step1.sub'),
    },
    {
      num: locale === 'bn' ? '২' : '2',
      color: 'bg-teal-600 dark:bg-teal-500',
      title: t('hero.step2.title'),
      subtitle: t('hero.step2.sub'),
    },
    {
      num: locale === 'bn' ? '৩' : '3',
      color: 'bg-lime-600 dark:bg-lime-500',
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
        <div className="relative rounded-3xl border border-border/40 bg-white p-6 shadow-2xl shadow-gray-300/50 dark:border-zinc-800/60 dark:bg-zinc-900 dark:shadow-none sm:p-7">
          {/* Card Header */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm font-semibold tracking-wide text-foreground">
              {t('hero.escrowStatus')}
            </p>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              {t('hero.secured')}
            </span>
          </div>

          {/* 3-Step Progress List */}
          <div>
            {steps.map((step, i) => (
              <div key={step.num}>
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black text-primary-foreground ${step.color}`}
                  >
                    {step.num}
                  </div>
                  <div className="min-w-0 pb-5 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.subtitle}
                    </p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="ml-3.5 h-4 w-px border-l border-dashed border-border" />
                )}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-border/60" />

          {/* Amount */}
          <div className="py-4 text-center">
            <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              ৳৫০,০০০<span className="text-lg">.০০</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('hero.exampleAmount')}
            </p>
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
                      onClick={() => {
                        if (isLandingDomain()) { window.location.href = getAppUrl('/dashboard'); return; }
                        navigateToDashboard();
                      }}
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
                      onClick={() => {
                        if (isLandingDomain()) { window.location.href = getAppUrl('/login'); return; }
                        useAppStore.getState().setView('auth');
                      }}
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