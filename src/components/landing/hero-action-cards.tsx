'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * HeroActionCards — the four primary CTA buttons of the Midman hero (2×2 grid)
 * ─────────────────────────────────────────────────────────────────────────────
 * Each button navigates to an EXISTING destination — no new routes, no changes
 * to auth/deal/marketplace/verify workflows:
 *
 *   1. Login / Registration → logged-in: role-aware dashboard
 *      (navigateToDashboard — admin → admin view, seller/buyer → dashboard),
 *      guest: existing auth view. The first slot is NEVER shown twice: the
 *      label, icon and handler swap with auth state, keeping the total at
 *      exactly four buttons.
 *   2. Marketplace          → existing /marketplace SPA view.
 *   3. Admin Deal           → Midman's deal service (NOT the admin panel):
 *      logged-in → dashboard "new-deal" panel, guest → login.
 *   4. Midman Verify        → the existing verify.midman.bd site.
 *
 * Layout: two columns × two rows at every breakpoint (per design spec) —
 * comfortable on mobile, aligned in the hero's right column on desktop.
 * Solid dark-green primary button; the other three use a light mint
 * background with a subtle green border. Restrained hover (arrow shift),
 * accessible focus rings, reduced-motion friendly.
 */

import { ArrowRight, CircleUserRound, Handshake, LayoutDashboard, ShieldCheck, Store, type LucideIcon } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

/* Shared button shell — equal height, consistent radius and focus states.
   Labels wrap to a second line on very narrow screens instead of truncating
   (min-h instead of fixed h), so the exact texts always stay readable. */
const BUTTON_CLASS =
  'group flex min-h-12 items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12.5px] font-semibold leading-tight transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-[52px] sm:min-h-[52px] sm:gap-2.5 sm:px-5 sm:py-0 sm:text-sm motion-reduce:transition-none';

/* Primary — solid dark forest green with white text (light mode); the brand
   green token takes over in dark mode, matching the site's solid buttons. */
const PRIMARY_CLASS = `${BUTTON_CLASS} bg-[#123B2A] text-white shadow-md shadow-black/[0.12] hover:bg-[#0E2F21] active:shadow-sm dark:bg-primary dark:text-primary-foreground dark:shadow-primary/20 dark:hover:bg-primary/90`;

/* Secondary — very light mint background, subtle green border, green text. */
const SECONDARY_CLASS = `${BUTTON_CLASS} border border-primary/25 bg-primary/[0.05] text-primary hover:border-primary/45 hover:bg-primary/[0.09] active:bg-primary/[0.07] dark:border-primary/30 dark:bg-primary/[0.1] dark:hover:border-primary/45 dark:hover:bg-primary/[0.16]`;

/* Right-arrow affordance shared by every button. */
function ButtonArrow() {
  return (
    <ArrowRight
      aria-hidden
      className="ml-auto h-4 w-4 shrink-0 opacity-70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
    />
  );
}

interface CtaButtonProps {
  icon: LucideIcon;
  label: string;
  href: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  external?: boolean;
  ariaLabel?: string;
  primary?: boolean;
}

function CtaButton({ icon: Icon, label, href, onClick, external, ariaLabel, primary }: CtaButtonProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={primary ? PRIMARY_CLASS : SECONDARY_CLASS}
    >
      <Icon aria-hidden className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" />
      <span className="min-w-0 flex-1">{label}</span>
      <ButtonArrow />
    </a>
  );
}

export function HeroActionCards() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const user = useAppStore((s) => s.user);

  /* Slot 1 — Login/Registration (guest) ⇄ Dashboard (logged-in, role-aware).
     Deliberately exclusive: the same grid slot changes with auth state. */
  const handleAuthSlot = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const s = useAppStore.getState();
    if (s.user) s.navigateToDashboard();
    else s.setView('auth');
  };

  /* Marketplace: existing SPA view */
  const handleMarketplace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    useAppStore.getState().setView('page-marketplace');
  };

  /* Admin Deal service (NOT the admin panel): existing hero workflow */
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

  return (
    <nav aria-label={t('hero.cards.navLabel')}>
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        <CtaButton
          primary
          icon={user ? LayoutDashboard : CircleUserRound}
          label={user ? t('hero.cards.dashboard.loggedIn') : t('hero.cards.dashboard.title')}
          href={user ? '/dashboard' : '/login'}
          onClick={handleAuthSlot}
        />
        <CtaButton
          icon={Store}
          label={t('hero.cards.marketplace.title')}
          href="/marketplace"
          onClick={handleMarketplace}
        />
        <CtaButton
          icon={Handshake}
          label={t('hero.cards.adminDeal.title')}
          href="/login"
          onClick={handleAdminDeal}
        />
        <CtaButton
          icon={ShieldCheck}
          label={t('hero.cards.verify.title')}
          href="https://verify.midman.bd"
          external
          ariaLabel={`${t('hero.cards.verify.title')} ${t('hero.cards.verify.external')}`}
        />
      </div>
    </nav>
  );
}
