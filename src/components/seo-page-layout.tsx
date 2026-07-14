import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { LiveSupportButton } from '@/components/live-support-button';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export function SeoPageLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col !bg-[#F2F4F7] dark:!bg-[#09090b]">
      <Navbar />
      <div className="flex flex-1 flex-col">
        {/* Home link */}
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            হোম
          </a>
        </div>

        {/* Page title */}
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-2 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
          )}
        </div>

        {/* Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-4 sm:px-6 sm:pb-16 lg:px-8">
          {children}
        </main>

        <Footer />
      </div>
      <LiveSupportButton />
    </div>
  );
}