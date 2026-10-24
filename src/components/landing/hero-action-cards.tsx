'use client';

/**
 * HeroActionCards — the four primary destination cards of the Midman hero.
 *
 * Each card navigates to an EXISTING destination — no new routes, no changes
 * to auth/deal/marketplace/verify workflows:
 *
 *   1. Dashboard / Login Registration → logged-in: role-aware dashboard
 *      (navigateToDashboard), guest: existing auth view (/login).
 *   2. Marketplace                    → existing /marketplace SPA view.
 *   3. Admin Deal                     → Midman's deal service (NOT the admin
 *      panel): logged-in → dashboard "new-deal" panel, guest → login.
 *   4. Midman Verify                  → the existing verify.midman.bd site.
 *
 * Layout: 1 column on very narrow screens, 2×2 from 420px (mobile/tablet),
 * single row of four on desktop (lg+). Full-card click/keyboard targets,
 * subtle lift + arrow-shift hover, reduced-motion friendly.
 */

import { ArrowRight, CircleUserRound, Handshake, ShieldCheck, Store, type LucideIcon } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

type Accent = 'green' | 'mint' | 'purple' | 'orange';

/* Coordinated accent tints — green stays primary (brand-dominant) */
const ACCENTS: Record<Accent, { chip: string; glow: string; icon: string; arrowHover: string }> = {
  green: {
    chip: 'bg-primary/10 dark:bg-primary/15',
    glow: 'bg-primary/[0.10] dark:bg-primary/[0.16]',
    icon: 'text-primary',
    arrowHover:
      'group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground',
  },
  mint: {
    chip: 'bg-[#DDF7EC] dark:bg-[#19342C]',
    glow: 'bg-[#14B8A6]/[0.10] dark:bg-[#14B8A6]/[0.16]',
    icon: 'text-[#0D9276] dark:text-[#5EEAD4]',
    arrowHover:
      'group-hover:bg-[#0D9276] group-hover:border-[#0D9276] group-hover:text-white dark:group-hover:bg-[#14B8A6] dark:group-hover:border-[#14B8A6]',
  },
  purple: {
    chip: 'bg-[#F1EBFE] dark:bg-[#2A2839]',
    glow: 'bg-[#8B5CF6]/[0.10] dark:bg-[#8B5CF6]/[0.16]',
    icon: 'text-[#7C3AED] dark:text-[#C4B5FD]',
    arrowHover:
      'group-hover:bg-[#7C3AED] group-hover:border-[#7C3AED] group-hover:text-white dark:group-hover:bg-[#8B5CF6] dark:group-hover:border-[#8B5CF6]',
  },
  orange: {
    chip: 'bg-[#FDEFDF] dark:bg-[#392C19]',
    glow: 'bg-[#F97316]/[0.10] dark:bg-[#F97316]/[0.16]',
    icon: 'text-[#EA580C] dark:text-[#FDBA74]',
    arrowHover:
      'group-hover:bg-[#EA580C] group-hover:border-[#EA580C] group-hover:text-white dark:group-hover:bg-[#F97316] dark:group-hover:border-[#F97316]',
  },
};

const CARD_CLASS =
  'group relative flex h-full flex-col rounded-[20px] border border-border/70 bg-card p-5 text-left shadow-sm shadow-black/[0.03] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0';

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: Accent;
  href: string;
  ariaLabel: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  external?: boolean;
}

function ActionCard({ icon: Icon, title, description, accent, href, ariaLabel, onClick, external }: ActionCardProps) {
  const a = ACCENTS[accent];
  return (
    <a
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={CARD_CLASS}
    >
      {/* soft accent glow (top-right corner wash) */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 opacity-60 group-hover:opacity-100 motion-reduce:transition-none ${a.glow}`}
      />

      <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none ${a.chip}`}>
        <Icon className={`h-[22px] w-[22px] ${a.icon}`} aria-hidden />
      </span>

      <h3 className="text-[15px] font-semibold leading-snug text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>

      <span className="mt-auto flex justify-end pt-4">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 ${a.arrowHover}`}
        >
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
        </span>
      </span>
    </a>
  );
}

export function HeroActionCards() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  /* Card 1 — Dashboard / Login: guests → auth view, logged-in → role-aware dashboard */
  const handleDashboard = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const s = useAppStore.getState();
    if (s.user) s.navigateToDashboard();
    else s.setView('auth');
  };

  /* Card 3 — Admin Deal service (NOT the admin panel): existing hero workflow */
  const handleAdminDeal = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const s = useAppStore.getState();
    if (s.user) {
      s.setView('dashboard');
      s.setDashboardPanel('new-deal');
    } else {
      s.setView('auth');
    }
  };

  /* Card 2 — Marketplace: existing SPA view */
  const handleMarketplace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    useAppStore.getState().setView('page-marketplace');
  };

  return (
    <nav aria-label={t('hero.cards.navLabel')} className="mt-10 pb-12 sm:mt-12 sm:pb-14 lg:mt-16 lg:pb-20">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <ActionCard
          icon={CircleUserRound}
          accent="green"
          title={t('hero.cards.dashboard.title')}
          description={t('hero.cards.dashboard.description')}
          href="/login"
          onClick={handleDashboard}
          ariaLabel={t('hero.cards.dashboard.title')}
        />
        <ActionCard
          icon={Store}
          accent="mint"
          title={t('hero.cards.marketplace.title')}
          description={t('hero.cards.marketplace.description')}
          href="/marketplace"
          onClick={handleMarketplace}
          ariaLabel={t('hero.cards.marketplace.title')}
        />
        <ActionCard
          icon={Handshake}
          accent="purple"
          title={t('hero.cards.adminDeal.title')}
          description={t('hero.cards.adminDeal.description')}
          href="/login"
          onClick={handleAdminDeal}
          ariaLabel={t('hero.cards.adminDeal.title')}
        />
        <ActionCard
          icon={ShieldCheck}
          accent="orange"
          title={t('hero.cards.verify.title')}
          description={t('hero.cards.verify.description')}
          href="https://verify.midman.bd"
          external
          ariaLabel={`${t('hero.cards.verify.title')} ${t('hero.cards.verify.external')}`}
        />
      </div>
    </nav>
  );
}
