'use client';

import { useSiteSettings } from '@/lib/use-site-settings';
import { useAppStore, type AppView } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { resolveGatewayIcon } from '@/lib/payment-gateways';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface FooterLink {
  label: string;
  view: AppView;
  href: string;
}

export function Footer() {
  const { siteName, siteNameEn, siteLogo, footerDescription, footerCopyrightText, footerMadeIn, paymentGateways } = useSiteSettings();
  const setView = useAppStore((s) => s.setView);
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const displayName = locale === 'en' ? siteNameEn : siteName;

  const defaultDescription = t('footer.defaultDescription');
  const defaultMadeIn = t('footer.defaultMadeIn');

  const footerLinks: FooterLink[][] = [
    [
      { label: t('nav.howItWorks'), view: 'page-how-it-works', href: '/how-it-works' },
      { label: t('nav.feeStructure'), view: 'page-fees', href: '/fees' },
      { label: t('nav.features'), view: 'page-security', href: '/security' },
      { label: t('nav.blog'), view: 'blog', href: '/blog' },
      { label: t('nav.faq'), view: 'page-faq', href: '/faq' },
    ],
    [
      { label: t('nav.about'), view: 'page-about', href: '/about' },
      { label: t('nav.contact'), view: 'page-contact', href: '/contact' },
      { label: t('page.privacy.title'), view: 'page-privacy', href: '/privacy' },
      { label: t('page.terms.title'), view: 'page-terms', href: '/terms' },
    ],
  ];

  const categories = [t('footer.cat.services'), t('footer.cat.company')] as const;

  const description = footerDescription || `${displayName} ${defaultDescription}`;
  const copyrightLine = footerCopyrightText || `© ${new Date().getFullYear()} ${displayName}। ${t('footer.allRightsReserved')}`;
  const madeIn = footerMadeIn || defaultMadeIn;

  // Footer payment gateway badges — admin-managed (default: bKash + Nagad)
  const paymentBadges = (paymentGateways || [])
    .filter((g) => g.enabled && resolveGatewayIcon(g));

  const goLanding = (e: React.MouseEvent) => { e.preventDefault(); setView('landing'); };
  const goLink = (view: AppView) => (e: React.MouseEvent) => { e.preventDefault(); setView(view); };

  /* ── Shared: brand logo ── */
  const brandLogo = (
    <a href="/" onClick={goLanding} className="group inline-flex items-center gap-2.5">
      {siteLogo ? (
        <img
          src={cdnUrl(siteLogo) || ''}
          alt={displayName}
          className="h-9 w-9 rounded-lg object-contain"
          loading="lazy" decoding="async"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-400/10">
          <span className="text-sm font-bold text-lime-400">{displayName?.charAt(0) || 'M'}</span>
        </div>
      )}
      <span className="text-lg font-bold tracking-tight text-white transition-colors group-hover:text-lime-300">
        {displayName}
      </span>
    </a>
  );

  /* ── Shared: brand description ── */
  const brandDescription = (
    <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
      {description}
    </p>
  );

  /* ── Shared: secure payment section ("নিরাপদ পেমেন্টের মাধ্যম") ── */
  const paymentSection = paymentBadges.length > 0 && (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-lime-400" aria-hidden />
        <h3 className="text-sm font-semibold text-white">{t('footer.payments')}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {paymentBadges.map((g) => (
          <span
            key={g.id}
            title={g.name}
            className="inline-flex h-10 min-w-[104px] items-center justify-center gap-2 rounded-xl bg-white px-3.5 shadow-[0_2px_14px_rgba(0,0,0,0.35)] ring-1 ring-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:ring-lime-400/50"
          >
            <img
              src={cdnUrl(resolveGatewayIcon(g)) || ''}
              alt={g.name}
              className="h-6 w-6 object-contain"
              loading="lazy"
              decoding="async"
            />
            <span className="text-xs font-bold tracking-tight text-zinc-900">{g.name}</span>
          </span>
        ))}
      </div>
    </div>
  );

  /* ── Shared: link list items (desktop) ── */
  const desktopLinkColumn = (cat: string, links: FooterLink[]) => (
    <div>
      <h3 className="text-sm font-semibold text-white">{cat}</h3>
      <div className="mb-5 mt-2.5 h-0.5 w-6 rounded-full bg-lime-400/70" aria-hidden />
      <ul className="space-y-3">
        {links.map((link, j) => (
          <li key={`${link.href}-${j}`}>
            <a
              href={link.href}
              onClick={goLink(link.view)}
              className="group inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {link.label}
              <ChevronRight
                className="h-3 w-3 shrink-0 -translate-x-1 text-lime-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="relative overflow-hidden bg-[#14171B]">
      {/* Subtle green glow decoration */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-64 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-lime-500/[0.07] blur-3xl" />
        <div className="absolute -bottom-24 right-[-6rem] h-56 w-80 rounded-full bg-lime-500/[0.05] blur-3xl" />
      </div>
      {/* Top hairline */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-400/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Desktop / Tablet: 3-column layout ── */}
        <div className="hidden py-14 md:grid md:grid-cols-12 md:gap-10 lg:gap-12">
          {/* Column 1 — Brand + payment */}
          <div className="md:col-span-12 lg:col-span-5">
            <div className="space-y-4">
              {brandLogo}
              {brandDescription}
            </div>
            {paymentSection && (
              <div className="mt-8">{paymentSection}</div>
            )}
          </div>

          {/* Column 2 — সেবা */}
          <div className="mt-10 md:col-span-6 lg:col-span-4 lg:mt-0">
            {desktopLinkColumn(categories[0], footerLinks[0])}
          </div>

          {/* Column 3 — কোম্পানি */}
          <div className="mt-10 md:col-span-6 lg:col-span-3 lg:mt-0">
            {desktopLinkColumn(categories[1], footerLinks[1])}
          </div>
        </div>

        {/* ── Mobile: single column with accordions ── */}
        <div className="py-10 md:hidden">
          <div className="space-y-4">
            {brandLogo}
            {brandDescription}
          </div>

          {paymentSection && (
            <div className="mt-8">{paymentSection}</div>
          )}

          <Accordion type="single" collapsible className="mt-8 border-t border-white/10">
            {footerLinks.map((links, i) => (
              <AccordionItem key={categories[i]} value={`footer-cat-${i}`} className="border-white/10">
                <AccordionTrigger className="py-4 text-sm font-semibold text-white hover:no-underline [&>svg]:text-zinc-500">
                  {categories[i]}
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    {links.map((link, j) => (
                      <li key={`${link.href}-${j}`}>
                        <a
                          href={link.href}
                          onClick={goLink(link.view)}
                          className="inline-flex items-center py-1 text-sm text-zinc-400 active:text-lime-300"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-white/10 py-6">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-center text-xs text-zinc-500 sm:text-left">
              {copyrightLine}
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400/90" aria-hidden />
              {madeIn}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
