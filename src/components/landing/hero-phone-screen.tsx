'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * HeroPhoneScreen — miniature Midman mobile interface inside the hero phone
 * ─────────────────────────────────────────────────────────────────────────────
 * Rendered through <SmartphoneMockup screen={<HeroPhoneScreen />} /> — the
 * documented extension path of the reusable phone frame (no changes to the
 * frame component itself).
 *
 * Content (per hero design spec):
 *   1. Compact app header (logo mark + brand + notification bell)
 *   2. Three vertically stacked feature cards — Marketplace, Admin Deal and
 *      Midman Verify — mirroring the real product surfaces
 *   3. Compact trust-statistics strip (non-numerical, platform-backed labels
 *      only — no invented counts)
 *   4. Bottom mobile navigation bar
 *
 * Everything is theme-aware via the existing design tokens (bg-background /
 * bg-card / text-foreground / primary) so light and dark modes both render
 * naturally. The whole screen is a decorative, NON-interactive preview:
 * aria-hidden + pointer-events-none (the real actions are the hero CTA
 * buttons), and all labels come from the shared i18n locale files.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Handshake,
  Home,
  LayoutGrid,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

export function HeroPhoneScreen() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  /* The three product surfaces — same titles as the hero CTA buttons */
  const featureCards = [
    { icon: Store, title: t('hero.cards.marketplace.title'), desc: t('hero.phone.marketplace.desc') },
    { icon: Handshake, title: t('hero.cards.adminDeal.title'), desc: t('hero.phone.adminDeal.desc') },
    { icon: ShieldCheck, title: t('hero.cards.verify.title'), desc: t('hero.phone.verify.desc') },
  ];

  /* Non-numerical trust labels — genuinely backed by the platform
     (escrow deals, verified businesses, secure payment flow) */
  const trustStats = [
    { icon: ShieldCheck, label: t('hero.phone.stat.escrow') },
    { icon: BadgeCheck, label: t('hero.phone.stat.verified') },
    { icon: Lock, label: t('hero.phone.stat.secure') },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col bg-background">
      {/* ── Mini app header (sits below the dynamic island) ── */}
      <div className="flex items-center justify-between px-4 pb-2 pt-7">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary">
            <ShieldCheck className="h-3 w-3 text-primary-foreground" />
          </span>
          <span className="text-[11px] font-bold tracking-tight text-foreground">Midman</span>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card">
          <Bell className="h-3 w-3 text-muted-foreground" />
        </span>
      </div>

      {/* ── Mini search bar ── */}
      <div className="mx-4 mt-1 flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[9.5px] text-muted-foreground">{t('hero.phone.search')}</span>
      </div>

      {/* ── Three stacked feature cards + trust strip (vertically centered) ── */}
      <div className="flex flex-1 flex-col justify-center gap-4 px-4 pt-3">
        {featureCards.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm shadow-black/[0.03]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold leading-tight text-foreground">{title}</span>
              <span className="mt-1 block truncate text-[9.5px] leading-snug text-muted-foreground">{desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </div>
        ))}

        {/* ── Compact trust-statistics strip ── */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-primary/15 bg-primary/[0.06] p-3 dark:border-primary/20 dark:bg-primary/[0.1]">
          {trustStats.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-[8px] font-medium leading-tight text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom mobile navigation bar ── */}
      <div className="mt-3 flex items-center justify-around border-t border-border/60 bg-card px-2 pb-2.5 pt-2">
        <Home className="h-4 w-4 text-primary" />
        <Store className="h-4 w-4 text-muted-foreground/70" />
        <span className="flex h-8 w-8 -translate-y-1.5 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/30">
          <Plus className="h-4 w-4 text-primary-foreground" />
        </span>
        <LayoutGrid className="h-4 w-4 text-muted-foreground/70" />
        <User className="h-4 w-4 text-muted-foreground/70" />
      </div>
    </div>
  );
}
