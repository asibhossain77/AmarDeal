'use client';

import { useSyncExternalStore } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  FileText,
  Handshake,
  FilePlus2,
  ShoppingBag,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleCheck,
  Landmark,
  Eye,
  Store,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation, type TranslationKey } from '@/lib/i18n';

const emptySubscribe = () => () => {};

type TFunc = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/* ── Animation variants ── */
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
};
const fadeIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
};

/* ═══════════════════════════════════════════════════════════════
   Product-style hero visual — a preview of the actual Midman
   product: Admin Deal progress card (center) + Marketplace
   product card + Midman Verify business profile (floating).
   Illustrative sample data only — no fabricated platform stats.
   ═══════════════════════════════════════════════════════════════ */

/* Floating mini card — icon tile protrudes from the LEFT edge */
function FloatingMiniCard({
  icon: Icon,
  title,
  value,
  valueClass,
  floatClass,
  delay,
  variant = 'light',
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  valueClass?: string;
  floatClass: string;
  delay: number;
  variant?: 'highlight' | 'light';
}) {
  const isHighlight = variant === 'highlight';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`pointer-events-none ${floatClass}`}
    >
      <div className="relative">
        <div
          className={[
            'relative overflow-hidden',
            'w-[122px] h-[56px] sm:w-[150px] sm:h-[60px] lg:w-[168px] lg:h-[66px] xl:w-[180px] xl:h-[70px]',
            'rounded-[14px] sm:rounded-[16px] lg:rounded-[18px]',
            'pl-[34px] pr-2.5 sm:pl-[42px] lg:pl-[46px] sm:pr-3',
            'py-2',
            isHighlight
              ? 'bg-primary/90 shadow-md shadow-primary/20 dark:shadow-primary/12'
              : 'border border-border/30 bg-white/60 shadow-sm shadow-black/[0.04] backdrop-blur-md dark:border-border/20 dark:bg-zinc-900/50 dark:shadow-black/[0.15]',
          ].join(' ')}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/[0.08]" />

          <p
            className={[
              'text-[9px] font-medium leading-tight sm:text-[10px]',
              isHighlight ? 'text-primary-foreground/70' : 'text-muted-foreground',
            ].join(' ')}
          >
            {title}
          </p>
          <p
            className={[
              'mt-0.5 truncate text-[11px] font-bold leading-tight sm:text-[12px] lg:text-[13px]',
              valueClass || (isHighlight ? 'text-primary-foreground' : 'text-foreground'),
            ].join(' ')}
          >
            {value}
          </p>
        </div>

        {/* Icon tile */}
        <div
          className={[
            'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center',
            'w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] lg:w-[42px] lg:h-[42px]',
            'rounded-[10px] sm:rounded-[11px] lg:rounded-[12px]',
            '-left-[17px] sm:-left-[19px]',
            'shadow-sm',
            isHighlight
              ? 'bg-primary/90 shadow-primary/25 dark:shadow-primary/15'
              : 'bg-primary/12 dark:bg-primary/15',
          ].join(' ')}
        >
          <Icon
            className={[
              'w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] lg:w-[20px] lg:h-[20px]',
              isHighlight ? 'text-primary-foreground' : 'text-primary',
            ].join(' ')}
            strokeWidth={2.2}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main card: Admin Deal progress interface ── */
function DealPreviewCard({ t }: { t: TFunc }) {
  const stages = [
    { label: t('hero.stage.created'), done: true, active: false },
    { label: t('hero.stage.payment'), done: true, active: false },
    { label: t('hero.stage.delivery'), done: false, active: true },
    { label: t('hero.stage.completed'), done: false, active: false },
  ];

  return (
    <motion.div variants={fadeIn} className="relative">
      {/* Subtle green glow behind card */}
      <div className="pointer-events-none absolute -inset-10 rounded-[40px] bg-primary/[0.05] blur-3xl dark:bg-primary/[0.06]" />

      <div className="main-card-float relative mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[400px] xl:max-w-[430px]">
        {/* Glass card body */}
        <div className="card-body-glass relative overflow-hidden rounded-[28px] sm:rounded-[32px] lg:rounded-[36px] border border-border/50 bg-white/85 p-4 shadow-2xl shadow-primary/[0.06] backdrop-blur-xl dark:border-border/30 dark:bg-zinc-900/75 dark:shadow-primary/[0.04] sm:p-5 lg:p-6">
          {/* Floating decorative blobs */}
          <div className="blob-float-1 pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/[0.07] blur-2xl dark:bg-primary/[0.05]" />
          <div className="blob-float-2 pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-primary/[0.05] blur-2xl dark:bg-primary/[0.04]" />

          {/* Inner light reflection */}
          <div className="pointer-events-none absolute -inset-px rounded-[28px] sm:rounded-[32px] lg:rounded-[36px] bg-gradient-to-br from-white/50 via-transparent to-transparent dark:from-white/[0.03]" />

          {/* Card header */}
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/15">
                <FileText className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-primary" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-foreground sm:text-[13px]">{t('hero.mock.dealTitle')}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground">{t('hero.mock.dealId')}</p>
              </div>
            </div>
            <span className="badge-shimmer relative shrink-0 overflow-hidden rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary sm:text-[11px]">
              {t('hero.mock.dealStatus')}
            </span>
          </div>

          {/* Deal amount */}
          <div className="relative my-3 sm:my-4 text-center">
            <div className="relative inline-flex flex-col items-center rounded-2xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-primary/[0.08] px-6 py-2.5 sm:px-8 sm:py-3 ring-1 ring-primary/10">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/[0.05] blur-xl" />
              <span className="relative text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                {t('hero.mock.amountLabel')}
              </span>
              <span className="relative text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                ৳12,500
              </span>
            </div>
          </div>

          {/* Buyer — Midman — Seller flow */}
          <div className="relative flex items-center justify-center gap-1.5 sm:gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-secondary/80 ring-1 ring-border">
                <span className="text-[10px] font-bold text-foreground sm:text-[11px]">{t('hero.flow.buyer').charAt(0)}</span>
              </div>
              <span className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">{t('hero.flow.buyer')}</span>
            </div>

            <div className="flex items-center">
              <div className="h-px w-3 bg-primary/40 sm:w-4" />
              <ArrowRight className="h-2.5 w-2.5 text-primary sm:h-3 sm:w-3" />
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <span className="text-[10px] font-bold sm:text-[11px]">M</span>
              </div>
              <span className="text-[9px] font-bold text-primary sm:text-[10px]">{t('hero.flow.midman')}</span>
            </div>

            <div className="flex items-center">
              <div className="h-px w-3 bg-primary/40 sm:w-4" />
              <ArrowRight className="h-2.5 w-2.5 text-primary sm:h-3 sm:w-3" />
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-secondary/80 ring-1 ring-border">
                <span className="text-[10px] font-bold text-foreground sm:text-[11px]">{t('hero.flow.seller').charAt(0)}</span>
              </div>
              <span className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">{t('hero.flow.seller')}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-border to-transparent sm:my-4" />

          {/* Progress stages */}
          <div className="relative rounded-xl bg-muted/40 p-2.5 dark:bg-zinc-800/30 sm:p-3">
            <div className="flex items-center justify-between">
              {stages.map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                    <div
                      className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full transition-all duration-300 ${
                        step.done
                          ? 'bg-primary text-primary-foreground'
                          : step.active
                            ? 'bg-primary/20 text-primary ring-2 ring-primary/40'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
                      ) : step.active ? (
                        <div className="progress-pulse h-1.5 w-1.5 rounded-full bg-primary sm:h-2 sm:w-2" />
                      ) : (
                        <CircleCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
                      )}
                    </div>
                    <span
                      className={`max-w-[46px] text-center text-[8px] font-medium leading-tight sm:max-w-[54px] sm:text-[9px] ${
                        step.done ? 'text-primary' : step.active ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < stages.length - 1 && (
                    <div className="mx-1 mb-3 h-px w-4 sm:mx-1.5 sm:mb-4 sm:w-5 lg:w-6">
                      <div className={`h-full rounded-full ${step.done ? 'bg-primary/60' : 'bg-border'}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: both mini cards in a compact row below the deal card */}
      <div className="mb-2 mt-5 flex items-center justify-center gap-3 sm:hidden">
        <FloatingMiniCard
          icon={ShoppingBag}
          title={t('hero.mock.marketplaceLabel')}
          value={t('hero.mock.productName')}
          floatClass=""
          delay={0.8}
          variant="light"
        />
        <FloatingMiniCard
          icon={BadgeCheck}
          title={t('hero.mock.verifyLabel')}
          value={t('hero.mock.businessName')}
          floatClass=""
          delay={1.0}
          variant="highlight"
        />
      </div>

      {/* Desktop (sm+): floating Marketplace card — TOP RIGHT */}
      <FloatingMiniCard
        icon={ShoppingBag}
        title={t('hero.mock.marketplaceLabel')}
        value={t('hero.mock.productName')}
        floatClass="hidden sm:block absolute float-card-2 top-[4%] -right-[56px] lg:-right-[48px] xl:-right-[88px]"
        delay={0.9}
        variant="light"
      />
      {/* Desktop (sm+): floating Midman Verify profile card — BOTTOM LEFT */}
      <FloatingMiniCard
        icon={BadgeCheck}
        title={t('hero.mock.verifyLabel')}
        value={t('hero.mock.businessName')}
        floatClass="hidden sm:block absolute float-card-3 bottom-[10%] -left-[56px] lg:-left-[72px] xl:-left-[88px]"
        delay={1.1}
        variant="highlight"
      />
    </motion.div>
  );
}

/* ── Service chips under CTAs ── */
function TrustChips({ t }: { t: TFunc }) {
  const items = [
    { icon: FileText, label: t('hero.chip.terms') },
    { icon: Eye, label: t('hero.chip.progress') },
    { icon: Building2, label: t('hero.chip.profile') },
  ];

  return (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:justify-start">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
          className="flex items-center gap-1.5"
        >
          <item.icon className="h-4 w-4 text-primary" strokeWidth={2} />
          <span className="text-xs font-medium text-muted-foreground sm:text-[13px]">{item.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Main Hero ── */
export function Hero() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const user = useAppStore((s) => s.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  /* Admin Deal CTA — start/continue deal for logged-in, auth for visitors */
  const handleAdminDeal = () => {
    const store = useAppStore.getState();
    if (store.user) {
      store.setView('dashboard');
      store.setDashboardPanel('new-deal');
    } else {
      store.setView('auth');
    }
  };

  /* Midman Verify CTA — business profile for sellers, dashboard (apply/verify entry) otherwise */
  const handleVerify = () => {
    const store = useAppStore.getState();
    if (store.user) {
      store.setView('dashboard');
      store.setDashboardPanel(store.user.isSeller ? 'seller-business-profile' : 'overview');
    } else {
      store.setView('auth');
    }
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background aura */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-primary/[0.06] blur-[120px] dark:bg-primary/[0.05]" />
        <div className="bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-primary/[0.03] blur-[100px] dark:bg-primary/[0.03]" />
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
        <div className="flex items-center py-10 sm:py-14 lg:min-h-[calc(100vh-4rem)] lg:py-20">
          <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-20 xl:gap-24">
            {/* Left: text content */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="order-1 flex flex-col items-center text-center lg:items-start lg:text-left"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-5 inline-flex max-w-full items-center justify-center gap-1.5 self-center rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-wide text-primary sm:px-4 sm:text-xs lg:self-auto"
              >
                <Landmark className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
                <span className="font-semibold tracking-wide text-primary">{t('hero.badge')}</span>
              </motion.div>

              {/* H1 — the only H1 on the homepage */}
              <h1 className="mb-4 text-center text-3xl font-bold leading-[1.3] tracking-tight sm:text-4xl lg:text-left lg:text-[2.5rem] lg:leading-[1.25] xl:text-[2.9rem]">
                {t('hero.headline.start')}{' '}
                <span className="glow-text-lime text-primary">{t('hero.headline.highlight')}</span>
                {t('hero.headline.end')}
              </h1>

              {/* Subtitle */}
              <p className="mx-auto mb-7 max-w-lg text-center text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-left lg:text-[17px]">
                {t('hero.subtitle')}
              </p>

              {/* CTA buttons */}
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center lg:justify-start"
              >
                <motion.div variants={fadeUp} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    onClick={() => useAppStore.getState().setView('page-marketplace')}
                    className="gap-2.5 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97]"
                  >
                    <Store className="h-5 w-5" />
                    {t('hero.cta.marketplace')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
                {mounted && user ? (
                  <motion.div variants={fadeUp} className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleAdminDeal}
                      className="gap-2.5 rounded-xl border-border/60 px-6 text-[15px] font-semibold transition-all duration-200 hover:border-primary/40 hover:text-primary active:scale-[0.97]"
                    >
                      <FilePlus2 className="h-5 w-5" />
                      {t('hero.cta.adminDeal')}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div variants={fadeUp} className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleAdminDeal}
                      className="gap-2.5 rounded-xl border-border/60 px-6 text-[15px] font-semibold transition-all duration-200 hover:border-primary/40 hover:text-primary active:scale-[0.97]"
                    >
                      <Handshake className="h-5 w-5" />
                      {t('hero.cta.adminDeal')}
                    </Button>
                  </motion.div>
                )}
              </motion.div>

              {/* Tertiary text link — Midman Verify */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                onClick={handleVerify}
                className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <BadgeCheck className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary" strokeWidth={2} />
                {t('hero.cta.verify')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </motion.button>

              {/* Trust chips */}
              <TrustChips t={t} />
            </motion.div>

            {/* Right: product-style visual */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
              className="order-2"
            >
              <div className="relative mx-auto w-full max-w-[380px] pb-6 sm:max-w-[440px] sm:pb-8 lg:max-w-[540px] lg:pb-10 xl:max-w-[560px]">
                <DealPreviewCard t={t} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
