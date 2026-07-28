'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * NavbarSkeleton — mimics the top navbar (logo + links + CTA)
 */
export function NavbarSkeleton() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-white/80 backdrop-blur-xl dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-24" />
        </div>
        {/* Nav links — desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </nav>
        {/* CTA + actions */}
        <div className="flex items-center gap-3">
          <Skeleton className="hidden sm:block h-4 w-16" />
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
    </header>
  );
}

/**
 * HeroSkeleton — mimics the hero section (heading + subtext + CTA + card)
 */
export function HeroSkeleton() {
  return (
    <section className="relative overflow-hidden py-16 md:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
          {/* Left — text content */}
          <div className="flex-1 space-y-6 text-center lg:text-left">
            <Skeleton className="mx-auto lg:mx-0 h-5 w-40 rounded-full" />
            <Skeleton className="mx-auto lg:mx-0 h-10 w-80 sm:w-96" />
            <Skeleton className="mx-auto lg:mx-0 h-10 w-72 sm:w-80" />
            <Skeleton className="mx-auto lg:mx-0 h-5 w-64" />
            <div className="flex items-center gap-3 justify-center lg:justify-start pt-2">
              <Skeleton className="h-11 w-36 rounded-xl" />
              <Skeleton className="h-11 w-36 rounded-xl" />
            </div>
            {/* Trust badges */}
            <div className="flex items-center gap-4 justify-center lg:justify-start pt-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
          {/* Right — escrow card */}
          <div className="w-full max-w-sm lg:max-w-none">
            <Skeleton className="h-[340px] w-full rounded-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * SectionSkeleton — generic content section with heading + content area
 */
export function SectionSkeleton() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section header */}
        <div className="text-center space-y-3">
          <Skeleton className="mx-auto h-3 w-28" />
          <Skeleton className="mx-auto h-7 w-64" />
          <Skeleton className="mx-auto h-4 w-80" />
        </div>
        {/* Content grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * ReviewSkeleton — mimics the review/testimonial cards
 */
export function ReviewSkeleton() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <Skeleton className="mx-auto h-3 w-28" />
          <Skeleton className="mx-auto h-7 w-56" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-white p-6 dark:bg-zinc-900 space-y-4">
              {/* Stars */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Skeleton key={s} className="h-4 w-4 rounded-sm" />
                ))}
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              {/* Author */}
              <div className="flex items-center gap-3 pt-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * FooterSkeleton — mimics the footer columns
 */
export function FooterSkeleton() {
  return (
    <footer className="border-t border-border/40 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-28" />
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-3.5 w-full" />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </footer>
  );
}

/**
 * LandingSkeleton — complete landing page skeleton
 */
export function LandingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col !bg-[#F2F4F7] dark:!bg-[#09090b]">
      <NavbarSkeleton />
      <main className="flex-1">
        <HeroSkeleton />
        <ReviewSkeleton />
        <SectionSkeleton />
      </main>
      <FooterSkeleton />
    </div>
  );
}
