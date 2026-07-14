'use client';

import { useEffect, useState } from 'react';
import { useAppStore, type UserInfo, type AppView } from '@/lib/store';
import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { TrustSecurity } from '@/components/landing/trust-security';
import { Footer } from '@/components/landing/footer';
import { PageWrapper } from '@/components/landing/page-wrapper';
import { HowItWorks } from '@/components/landing/how-it-works';
import { FeeStructure } from '@/components/landing/fee-structure';
import { FAQSection } from '@/components/landing/faq-section';
import { AboutSection } from '@/components/landing/about-section';
import { PrivacySection } from '@/components/landing/privacy-section';
import { ContactSection } from '@/components/landing/contact-section';
import { ContractSection } from '@/components/landing/contract-section';
import { ReviewSection } from '@/components/landing/review-section';
import { AuthView } from '@/components/auth/auth-view';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { AdminView } from '@/components/admin/admin-view';
import { SellerView } from '@/components/seller/seller-view';
import { BlogView } from '@/components/landing/blog-view';
import { LiveSupportButton } from '@/components/live-support-button';
import { SiteLoader } from '@/components/shared/site-loader';

/* ── Slim landing — only Hero + Trust + CTA ── */
function LandingView() {
  return (
    <>
      <main className="flex-1">
        <Hero />
        <ReviewSection />
        <TrustSecurity />
      </main>
      <Footer />
    </>
  );
}

/* ── Separate pages ── */
function PageHowItWorks() {
  return (
    <PageWrapper title="কিভাবে কাজ করে" subtitle="মাত্র তিনটি ধাপে নিরাপদ লেনদেন সম্পন্ন করুন">
      <HowItWorks />
    </PageWrapper>
  );
}

function PageFees() {
  return (
    <PageWrapper title="ফি কাঠামো" subtitle="স্বচ্ছ ও সাশ্রয়ী ফি স্ট্রাকচার">
      <FeeStructure />
    </PageWrapper>
  );
}

function PageSecurity() {
  return (
    <PageWrapper title="নিরাপত্তা" subtitle="আপনার লেনদেন সম্পূর্ণ সুরক্ষিত">
      <TrustSecurity />
    </PageWrapper>
  );
}

function PageFaq() {
  return (
    <PageWrapper title="ঘন ঘন জিজ্ঞাসিত প্রশ্নাবলী" subtitle="আমাদের সেবা সম্পর্কে সাধারণ প্রশ্ন ও উত্তর">
      <FAQSection />
    </PageWrapper>
  );
}

function PageAbout() {
  return (
    <PageWrapper title="আমাদের সম্পর্কে" subtitle="নিরাপদ লেনদেনের বিশ্বস্ত ঠিকানা">
      <AboutSection />
    </PageWrapper>
  );
}

function PagePrivacy() {
  return (
    <PageWrapper title="গোপনীয়তা নীতি" subtitle="আপনার তথ্য কিভাবে সুরক্ষিত আছে তা জানুন">
      <PrivacySection />
    </PageWrapper>
  );
}

function PageTerms() {
  return (
    <PageWrapper title="শর্তাবলী ও চুক্তি" subtitle="আমাদের সেবার শর্তাবলী ও ব্যবহারের শর্ত">
      <ContractSection />
    </PageWrapper>
  );
}

function PageContact() {
  return (
    <PageWrapper title="যোগাযোগ" subtitle="আমাদের সাথে যোগাযোগ করুন">
      <ContactSection />
    </PageWrapper>
  );
}

function BlogPage() {
  return (
    <PageWrapper>
      <BlogView />
    </PageWrapper>
  );
}

export function AppShell({ initialView }: { initialView?: AppView }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const setUser = useAppStore((s) => s.setUser);
  const [checking, setChecking] = useState(true);
  const [minReady, setMinReady] = useState(false);

  // Set initial view on mount (for SEO routes)
  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView, setView]);

  // Minimum 1.8s loader display
  useEffect(() => {
    const t = setTimeout(() => setMinReady(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Scroll to top whenever the view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  // Restore session from cookie on page load / refresh
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('no session');
        return res.json() as Promise<UserInfo>;
      })
      .then((user) => {
        setUser(user);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [setUser]);

  if (!minReady || checking) {
    return <SiteLoader />;
  }

  return (
    <div className="min-h-screen flex flex-col !bg-[#F2F4F7] dark:!bg-[#09090b]">
      <Navbar />
      {view === 'auth' && <AuthView />}
      {view === 'dashboard' && <DashboardView />}
      {view === 'seller' && <SellerView />}
      {view === 'admin' && <AdminView />}
      {view === 'landing' && <LandingView />}
      {view === 'blog' && <BlogPage />}
      {view === 'page-how-it-works' && <PageHowItWorks />}
      {view === 'page-fees' && <PageFees />}
      {view === 'page-security' && <PageSecurity />}
      {view === 'page-faq' && <PageFaq />}
      {view === 'page-about' && <PageAbout />}
      {view === 'page-privacy' && <PagePrivacy />}
      {view === 'page-terms' && <PageTerms />}
      {view === 'page-contact' && <PageContact />}
      <LiveSupportButton />
    </div>
  );
}