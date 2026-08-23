'use client';

import { useSiteSettings } from '@/lib/use-site-settings';
import { useAppStore, type AppView } from '@/lib/store';
import { isAppDomain } from '@/lib/domain';
import { useTranslation } from '@/lib/i18n';
import { Separator } from '@/components/ui/separator';

export function Footer() {
  const { siteName, siteNameEn, siteLogo, footerDescription, footerCopyrightText, footerMadeIn } = useSiteSettings();
  const setView = useAppStore((s) => s.setView);
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const displayName = locale === 'en' ? siteNameEn : siteName;

  const defaultDescription = t('footer.defaultDescription');
  const defaultMadeIn = t('footer.defaultMadeIn');

  const footerLinks: { label: string; view: AppView; href: string }[][] = [
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

  return (
    <footer className="border-t border-border/50 bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <a href="/" onClick={(e) => { e.preventDefault(); if (isAppDomain()) { const { navigateToDashboard } = useAppStore.getState(); navigateToDashboard(); } else setView('landing'); }} className="mb-4 flex items-center gap-2.5">
              {siteLogo ? (
                <img
                  src={siteLogo}
                  alt={displayName}
                  className="h-9 w-9 rounded-lg object-contain"
                  loading="lazy" decoding="async"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <span className="text-sm font-bold text-primary">{displayName?.charAt(0) || 'M'}</span>
                </div>
              )}
              <span className="text-lg font-bold tracking-tight">
                {displayName}
              </span>
            </a>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          {/* Links Columns */}
          {categories.map((cat, i) => (
            <div key={cat}>
              <h3 className="mb-4 text-sm font-semibold">{cat}</h3>
              <ul className="space-y-2.5">
                {footerLinks[i].map((link, j) => (
                  <li key={`${link.href}-${j}`}>
                    <a
                      href={link.href}
                      onClick={(e) => { e.preventDefault(); setView(link.view); }}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8 bg-border/50" />

        {/* Copyright */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {copyrightLine}
          </p>
          <p className="text-xs text-muted-foreground">
            {madeIn}
          </p>
        </div>
      </div>
    </footer>
  );
}