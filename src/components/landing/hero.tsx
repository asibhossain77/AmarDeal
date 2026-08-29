'use client';

import { useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  LayoutDashboard,
  ShieldCheck,
  Shield,
  UserCheck,
  CircleCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useTranslation } from '@/lib/i18n';

const emptySubscribe = () => () => {};

// Animation Variants
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
};
const fadeIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
};

// Floating Mini Card - icon container sits partially OUTSIDE the card, overlapping its edge
// iconOnRight: when true, icon protrudes from the RIGHT side (for left-positioned cards)
function FloatingMiniCard({
  icon: Icon,
  title,
  value,
  floatClass,
  delay,
  variant = 'light',
  iconOnRight = false,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  floatClass: string;
  delay: number;
  variant?: 'highlight' | 'light';
  iconOnRight?: boolean;
}) {
  const isHighlight = variant === 'highlight';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`pointer-events-none absolute z-20 ${floatClass}`}
    >
      <div className="relative">
        {/* Card body - the main rectangular surface */}
        <div
          className={[
            'relative overflow-hidden',
            // Responsive sizing
            'w-[135px] h-[60px] sm:w-[155px] sm:h-[66px] lg:w-[170px] lg:h-[74px] xl:w-[180px] xl:h-[78px]',
            // Border radius
            'rounded-[17px] sm:rounded-[19px] lg:rounded-[20px]',
            // Padding - extra on the icon side so text doesn't hide behind icon
            iconOnRight
              ? 'pl-3 sm:pl-3.5 pr-8 sm:pr-10 lg:pr-11 xl:pr-12'
              : 'pl-8 sm:pl-10 lg:pl-11 xl:pl-12 pr-3 sm:pr-3.5',
            'pt-2.5 pb-2 sm:pt-3 sm:pb-2.5 lg:pt-3.5 lg:pb-3',
            // Surface
            isHighlight
              ? 'bg-primary shadow-xl shadow-primary/25 dark:shadow-primary/15'
              : 'border border-border/40 bg-white/90 shadow-lg shadow-black/[0.06] backdrop-blur-md dark:border-border/25 dark:bg-zinc-900/70 dark:shadow-black/[0.2]',
          ].join(' ')}
        >
          {/* Subtle top highlight line for premium feel */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/[0.08]" />

          <p
            className={[
              'text-[10px] font-medium leading-tight sm:text-[11px] lg:text-[11px]',
              isHighlight ? 'text-primary-foreground/70' : 'text-muted-foreground',
            ].join(' ')}
          >
            {title}
          </p>
          <p
            className={[
              'mt-0.5 text-[13px] font-bold leading-tight sm:text-[14px] lg:text-[15px]',
              isHighlight ? 'text-primary-foreground' : 'text-foreground',
            ].join(' ')}
          >
            {value}
          </p>
        </div>

        {/* Icon container - extends OUTSIDE the card edge */}
        <div
          className={[
            'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center',
            // Responsive icon container size
            'w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] lg:w-[44px] lg:h-[44px] xl:w-[46px] xl:h-[46px]',
            'rounded-[11px] sm:rounded-[12px] lg:rounded-[14px]',
            // Position: extends outside the card's edge toward the dashboard
            iconOnRight
              ? '-right-[12px] sm:-right-[13px] lg:-right-[15px] xl:-right-[16px]'
              : '-left-[12px] sm:-left-[13px] lg:-left-[15px] xl:-left-[16px]',
            // Surface color
            isHighlight
              ? 'bg-primary shadow-lg shadow-primary/30 dark:shadow-primary/20'
              : 'bg-primary/15 dark:bg-primary/20 shadow-md',
          ].join(' ')}
        >
          <Icon
            className={[
              'w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] lg:w-[21px] lg:h-[21px] xl:w-[22px] xl:h-[22px]',
              isHighlight ? 'text-primary-foreground' : 'text-primary',
            ].join(' ')}
            strokeWidth={2.2}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Main Escrow Dashboard Card
function EscrowDashboard({ locale, t }: { locale: string; t: (key: string) => string }) {
  const progressSteps = [
    { label: t('hero.status.paymentSecured'), active: true, done: true },
    { label: t('hero.status.workProgress'), active: true, done: false },
    { label: t('hero.status.dealCompleted'), active: false, done: false },
  ];

  const stats = [
    { label: t('hero.stat.held'), value: locale === 'bn' ? '৳২৫,০০০' : '৳25,000' },
    { label: t('hero.stat.completedDeals'), value: locale === 'bn' ? '১২৮' : '128' },
    { label: t('hero.stat.successRate'), value: '99.8%' },
  ];

  return (
    <motion.div variants={fadeIn} className="relative">
      {/* Subtle green glow behind card */}
      <div className="pointer-events-none absolute -inset-10 rounded-3xl bg-primary/[0.05] blur-3xl dark:bg-primary/[0.06]" />

      <div className="main-card-float relative mx-auto max-w-[280px] sm:max-w-xs lg:max-w-sm xl:max-w-md">
        {/* Glass card body */}
        <div className="card-body-glass relative overflow-hidden rounded-2xl border border-border/50 bg-white/85 p-5 shadow-2xl shadow-primary/[0.06] backdrop-blur-xl dark:border-border/30 dark:bg-zinc-900/75 dark:shadow-primary/[0.04] sm:p-6">

          {/* Floating decorative blobs */}
          <div className="blob-float-1 pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/[0.07] blur-2xl dark:bg-primary/[0.05]" />
          <div className="blob-float-2 pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-primary/[0.05] blur-2xl dark:bg-primary/[0.04]" />

          {/* Inner light reflection */}
          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-white/50 via-transparent to-transparent dark:from-white/[0.03]" />

          {/* Card Header */}
          <div className="relative mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                <ShieldCheck className="h-[18px] w-[18px] text-primary" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{t('hero.escrowBalance')}</p>
                <p className="text-[11px] text-muted-foreground">{t('hero.dealId')}</p>
              </div>
            </div>
            <span className="badge-shimmer relative overflow-hidden rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary">
              {t('hero.status.paymentSecured')}
            </span>
          </div>

          {/* Escrow Amount Display */}
          <div className="relative mb-5 text-center">
            <div className="relative inline-flex items-baseline rounded-2xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-primary/[0.08] px-6 py-3 ring-1 ring-primary/10">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/[0.05] blur-xl" />
              <span className="relative text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
                {locale === 'bn' ? '৳২৫,০০০' : '৳25,000'}
              </span>
            </div>
          </div>

          {/* Buyer - Midman - Seller Flow */}
          <div className="relative mb-5 flex items-center justify-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 ring-1 ring-border">
                <span className="text-[11px] font-bold text-foreground">{locale === 'bn' ? 'ক্রেতা' : 'B'}</span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{t('hero.flow.buyer')}</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <div className="h-px w-4 bg-primary/40" />
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <span className="text-[11px] font-bold">M</span>
              </div>
              <span className="text-[10px] font-bold text-primary">{t('hero.flow.midman')}</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <div className="h-px w-4 bg-primary/40" />
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 ring-1 ring-border">
                <span className="text-[11px] font-bold text-foreground">{locale === 'bn' ? 'বিক্রেতা' : 'S'}</span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{t('hero.flow.seller')}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="mb-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Stats Grid */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
                className="rounded-xl bg-muted/50 p-2.5 text-center dark:bg-zinc-800/40"
              >
                <p className="text-[10px] font-medium text-muted-foreground leading-tight">{stat.label}</p>
                <p className="mt-1 text-sm font-bold text-foreground">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Progress Indicator */}
          <div className="rounded-xl bg-muted/40 p-3 dark:bg-zinc-800/30">
            <div className="flex items-center justify-between">
              {progressSteps.map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
                        step.done
                          ? 'bg-primary text-primary-foreground'
                          : step.active
                            ? 'bg-primary/20 text-primary ring-2 ring-primary/40'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                      ) : step.active ? (
                        <div className="h-2 w-2 rounded-full bg-primary progress-pulse" />
                      ) : (
                        <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-medium leading-tight text-center max-w-[56px] ${
                        step.done ? 'text-primary' : step.active ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < progressSteps.length - 1 && (
                    <div className="mx-1.5 mb-4 h-px w-6 sm:w-8">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          step.done ? 'bg-primary/60' : 'bg-border'
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Floating Mini Cards - orbit the dashboard, icons face toward it */}
      {/* Card 1: Payment Secured - top-left, icon faces RIGHT toward dashboard */}
      <FloatingMiniCard
        icon={Shield}
        title={t('hero.float.paymentSecured')}
        value={locale === 'bn' ? '৳২৫,০০০' : '৳25,000'}
        floatClass="float-card-1 -top-9 -left-2 sm:-top-12 sm:-left-5 lg:-top-14 lg:-left-[90px] xl:-left-[110px]"
        delay={0.8}
        variant="light"
        iconOnRight={true}
      />
      {/* Card 2: Verified User - top-right, icon faces LEFT toward dashboard */}
      <FloatingMiniCard
        icon={UserCheck}
        title={t('hero.float.verifiedUser')}
        value={t('hero.float.trusted')}
        floatClass="float-card-2 -top-7 -right-2 sm:-top-10 sm:-right-5 lg:-top-12 lg:-right-[90px] xl:-right-[110px]"
        delay={1.0}
        variant="light"
        iconOnRight={false}
      />
      {/* Card 3: Deal Completed - bottom-left, HIGHLIGHT card, icon faces RIGHT */}
      <FloatingMiniCard
        icon={CheckCircle2}
        title={t('hero.float.dealCompleted')}
        value={locale === 'bn' ? '+৳৮,৫০০' : '+৳8,500'}
        floatClass="float-card-3 -bottom-7 -left-2 sm:-bottom-10 sm:-left-5 lg:-bottom-12 lg:-left-[90px] xl:-left-[110px]"
        delay={1.2}
        variant="highlight"
        iconOnRight={true}
      />
      {/* Card 4: Deal Protected - bottom-right, icon faces LEFT toward dashboard */}
      <FloatingMiniCard
        icon={ShieldCheck}
        title={t('hero.float.dealProtected')}
        value={t('hero.float.hundredSecure')}
        floatClass="float-card-4 -bottom-9 -right-2 sm:-bottom-12 sm:-right-5 lg:-bottom-14 lg:-right-[90px] xl:-right-[110px]"
        delay={1.4}
        variant="light"
        iconOnRight={false}
      />
    </motion.div>
  );
}

// Main Hero Component
export function Hero() {
  const { siteName, siteNameEn } = useSiteSettings();
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const user = useAppStore((s) => s.user);
  const navigateToDashboard = useAppStore((s) => s.navigateToDashboard);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  return (
    <section className="relative overflow-hidden">
      {/* Background aura */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-primary/[0.06] blur-[120px] dark:bg-primary/[0.05]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-primary/[0.03] blur-[100px] dark:bg-primary/[0.03]" />
      </div>

      {/* Subtle background grid (light mode only) */}
      <div className="pointer-events-none absolute inset-0 dark:hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, oklch(0.768 0.189 131) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[calc(100vh-4rem)] items-center py-10 sm:py-14 lg:py-20">
          <div className="grid w-full items-center gap-8 lg:grid-cols-2 lg:gap-14 xl:gap-20">
            {/* Left Side: Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="order-1 flex flex-col items-center text-center lg:items-start lg:text-left"
            >
              {/* Premium Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-5 inline-flex items-center justify-center gap-2 self-center lg:self-auto rounded-full border border-primary/20 bg-primary/[0.08] px-4 py-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                <span className="text-xs font-semibold tracking-wide text-primary">
                  {t('hero.badge')}
                </span>
              </motion.div>

              {/* Main Heading */}
              <h1 className="mb-4 text-center text-3xl font-bold leading-[1.25] tracking-tight sm:text-4xl lg:text-left lg:text-[2.75rem] xl:text-5xl">
                {t('hero.heading.line1')}
                <br />
                <span className="glow-text-lime text-primary">{t('hero.heading.highlight')}</span>
              </h1>

              {/* Subtitle */}
              <p className="mx-auto mb-7 max-w-lg text-center text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-left lg:text-[17px]">
                {t('hero.subtitle')}
              </p>

              {/* CTA Buttons */}
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:items-start lg:justify-start"
              >
                {user ? (
                  <motion.div variants={fadeUp}>
                    <Button
                      size="lg"
                      onClick={() => navigateToDashboard()}
                      className="gap-2.5 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 active:scale-[0.97] transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      {t('hero.startDeal')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <>
                    <motion.div variants={fadeUp}>
                      <Button
                        size="lg"
                        onClick={() => useAppStore.getState().setView('auth')}
                        className="gap-2.5 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 active:scale-[0.97] transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
                      >
                        {t('hero.startDeal')}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <button
                        onClick={() => useAppStore.getState().setView('page-how-it-works')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 px-7 py-3 text-[15px] font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:text-foreground"
                      >
                        {t('hero.howWorks')}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </motion.div>

            {/* Right Side: Escrow Dashboard */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
              className="order-2 lg:order-2"
            >
              <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[480px] xl:max-w-[520px]">
                <EscrowDashboard locale={locale} t={t} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
