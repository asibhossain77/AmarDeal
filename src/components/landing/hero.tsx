'use client';

import {
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  Handshake,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

/* ═══════════════════════════════════════════════════════════════
   Minimal hero — title, one-line description, three CTAs.
   Pure typography + spacing on the theme background: no cards,
   no mockups, no gradients, no animation. Light/dark adaptive
   through theme tokens only.
   ═══════════════════════════════════════════════════════════════ */
export function Hero() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  /* Admin Deal CTA — logged-in users go straight to deal creation,
     visitors to the auth view (existing workflow, unchanged). */
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
    <section className="relative">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center py-14 text-center sm:py-20 lg:py-24">
          {/* H1 — the only H1 on the homepage */}
          <h1 className="max-w-3xl text-3xl font-bold leading-[1.3] tracking-tight text-foreground sm:text-4xl sm:leading-[1.28] lg:text-[2.75rem] lg:leading-[1.25]">
            {t('hero.headline.start')}{' '}
            <span className="text-primary">{t('hero.headline.highlight')}</span>
            {t('hero.headline.end')}
          </h1>

          {/* Supporting description */}
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">
            {t('hero.subtitle')}
          </p>

          {/* Three CTA buttons — one row on desktop, stacked on mobile */}
          <div className="mt-8 flex w-full max-w-sm flex-col items-stretch justify-center gap-3 sm:mt-10 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
            {/* Marketplace — existing in-app marketplace view */}
            <Button
              size="lg"
              onClick={() => useAppStore.getState().setView('page-marketplace')}
              className="h-11 rounded-xl px-7 text-[15px] font-semibold shadow-sm shadow-primary/20 transition-colors hover:shadow-md hover:shadow-primary/25"
            >
              <Store className="h-[18px] w-[18px]" />
              {t('hero.cta.marketplace')}
              <ArrowRight className="h-4 w-4" />
            </Button>

            {/* Admin Deal — preserved auth workflow */}
            <Button
              size="lg"
              variant="outline"
              onClick={handleAdminDeal}
              className="h-11 rounded-xl border-border/70 px-7 text-[15px] font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Handshake className="h-[18px] w-[18px]" />
              {t('hero.cta.adminDeal')}
            </Button>

            {/* Midman Verify — real external link to the verify site */}
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-11 rounded-xl border-border/70 px-7 text-[15px] font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <a
                href="https://verify.midman.bd"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BadgeCheck className="h-[18px] w-[18px]" />
                {t('hero.cta.verify')}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
