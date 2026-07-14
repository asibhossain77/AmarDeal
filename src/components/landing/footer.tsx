'use client';

import { useSiteSettings } from '@/lib/use-site-settings';
import { useAppStore, type AppView } from '@/lib/store';
import { Separator } from '@/components/ui/separator';

const defaultDescription = 'বাংলাদেশের সবচেয়ে বিশ্বস্ত এসক্রো প্ল্যাটফর্ম। আমরা নিরাপদ অনলাইন লেনদেন নিশ্চিত করি যাতে আপনি নিশ্চিন্তে কেনাবেচা করতে পারেন।';
const defaultCopyright = `© ${new Date().getFullYear()} আমার ডিল। সর্বস্বত্ব সংরক্ষিত।`;
const defaultMadeIn = 'বাংলাদেশে তৈরি';

const footerLinks: { label: string; view: AppView; href: string }[][] = [
  [
    { label: 'কিভাবে কাজ করে', view: 'page-how-it-works', href: '/how-it-works' },
    { label: 'ফি কাঠামো', view: 'page-fees', href: '/fees' },
    { label: 'নিরাপত্তা', view: 'page-security', href: '/security' },
    { label: 'ব্লগ', view: 'blog', href: '/blog' },
    { label: 'FAQ', view: 'page-faq', href: '/faq' },
  ],
  [
    { label: 'আমাদের সম্পর্কে', view: 'page-about', href: '/about' },
    { label: 'যোগাযোগ', view: 'page-contact', href: '/contact' },
    { label: 'গোপনীয়তা নীতি', view: 'page-privacy', href: '/privacy' },
    { label: 'শর্তাবলী', view: 'page-terms', href: '/terms' },
    { label: 'চুক্তি পেজ', view: 'page-terms', href: '/terms' },
  ],
];

const categories = ['সেবা', 'কোম্পানি'] as const;

export function Footer() {
  const { siteName, siteLogo, footerDescription, footerCopyrightText, footerMadeIn } = useSiteSettings();
  const setView = useAppStore((s) => s.setView);

  const description = footerDescription || `${siteName} ${defaultDescription}`;
  const copyrightLine = footerCopyrightText || `© ${new Date().getFullYear()} ${siteName}। সর্বস্বত্ব সংরক্ষিত।`;
  const madeIn = footerMadeIn || defaultMadeIn;

  return (
    <footer className="border-t border-border/50 bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <a href="/" onClick={(e) => { e.preventDefault(); setView('landing'); }} className="mb-4 flex items-center gap-2.5">
              <img
                src={siteLogo}
                alt={siteName}
                className="h-9 w-9 rounded-lg object-contain"
              />
              <span className="text-lg font-bold tracking-tight">
                {siteName}
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
                {footerLinks[i].map((link) => (
                  <li key={link.label}>
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