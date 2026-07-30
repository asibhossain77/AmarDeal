'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore, type UserInfo, type AppView } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { initUrlSync, reapplyUrlAfterLogin } from '@/lib/url-sync';
import { toast } from 'sonner';

/* ── Eager: above-the-fold landing components ── */
import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { PageWrapper } from '@/components/landing/page-wrapper';

/* ── Dynamic: landing sections with section skeleton fallback ── */
const TrustSecurity = dynamic(() => import('@/components/landing/trust-security').then(m => ({ default: m.TrustSecurity })), { ssr: false, loading: () => <SectionSkeleton /> });
const Footer = dynamic(() => import('@/components/landing/footer').then(m => ({ default: m.Footer })), { ssr: false });
const ReviewSection = dynamic(() => import('@/components/landing/review-section').then(m => ({ default: m.ReviewSection })), { ssr: false, loading: () => <SectionSkeleton /> });
const HowItWorks = dynamic(() => import('@/components/landing/how-it-works').then(m => ({ default: m.HowItWorks })), { ssr: false, loading: () => <SectionSkeleton /> });
const FeeStructure = dynamic(() => import('@/components/landing/fee-structure').then(m => ({ default: m.FeeStructure })), { ssr: false, loading: () => <SectionSkeleton /> });
const FAQSection = dynamic(() => import('@/components/landing/faq-section').then(m => ({ default: m.FAQSection })), { ssr: false, loading: () => <SectionSkeleton /> });
const AboutSection = dynamic(() => import('@/components/landing/about-section').then(m => ({ default: m.AboutSection })), { ssr: false, loading: () => <SectionSkeleton /> });
const PrivacySection = dynamic(() => import('@/components/landing/privacy-section').then(m => ({ default: m.PrivacySection })), { ssr: false, loading: () => <SectionSkeleton /> });
const ContactSection = dynamic(() => import('@/components/landing/contact-section').then(m => ({ default: m.ContactSection })), { ssr: false, loading: () => <SectionSkeleton /> });
const ContractSection = dynamic(() => import('@/components/landing/contract-section').then(m => ({ default: m.ContractSection })), { ssr: false, loading: () => <SectionSkeleton /> });
const BlogView = dynamic(() => import('@/components/landing/blog-view').then(m => ({ default: m.BlogView })), { ssr: false, loading: () => <SectionSkeleton /> });

/* ── Dynamic: live support widget (not needed on first paint) ── */
const LiveSupportButton = dynamic(() => import('@/components/live-support-button').then(m => ({ default: m.LiveSupportButton })), { ssr: false });
const SitePopup = dynamic(() => import('@/components/shared/site-popup').then(m => ({ default: m.SitePopup })), { ssr: false });

/* ── Skeletons for dynamic imports ── */
import { AuthSkeleton } from '@/components/shared/skeletons/auth-skeleton';
import { PanelSkeleton, SidebarSkeleton } from '@/components/shared/skeletons/panel-skeleton';
import { SectionSkeleton } from '@/components/shared/skeletons/landing-skeleton';

/* ── Eager: site loader (shown immediately) ── */
import { DynamicFavicon } from '@/components/shared/dynamic-favicon';
import { SiteLoader } from '@/components/shared/site-loader';

/* ── Dynamic: heavy views (admin, dashboard, auth, seller) — with skeleton fallbacks ── */
const AuthView = dynamic(() => import('@/components/auth/auth-view').then(m => ({ default: m.AuthView })), { ssr: false, loading: () => <AuthSkeleton /> });
const DashboardView = dynamic(() => import('@/components/dashboard/dashboard-view').then(m => ({ default: m.DashboardView })), { ssr: false, loading: () => <DashboardLoadingShell /> });
const AdminView = dynamic(() => import('@/components/admin/admin-view').then(m => ({ default: m.AdminView })), { ssr: false, loading: () => <PanelLoadingShell /> });
const SellerView = dynamic(() => import('@/components/seller/seller-view').then(m => ({ default: m.SellerView })), { ssr: false, loading: () => <PanelLoadingShell /> });

/* ── Panel loading shells — sidebar + content skeleton ── */
function PanelLoadingShell() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <SidebarSkeleton />
      <div className="flex-1 md:pl-64">
        <PanelSkeleton />
      </div>
    </div>
  );
}

function DashboardLoadingShell() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] min-w-0">
      <SidebarSkeleton />
      <div className="flex-1 min-w-0 md:pl-64 overflow-x-hidden">
        <PanelSkeleton />
      </div>
    </div>
  );
}

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

/* ── Separate pages with translations ── */
function PageHowItWorks() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.howItWorks.title')} subtitle={t('page.howItWorks.subtitle')}>
      <HowItWorks />
    </PageWrapper>
  );
}

function PageFees() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.fees.title')} subtitle={t('page.fees.subtitle')}>
      <FeeStructure />
    </PageWrapper>
  );
}

function PageSecurity() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.security.title')} subtitle={t('page.security.subtitle')}>
      <TrustSecurity />
    </PageWrapper>
  );
}

function PageFaq() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.faq.title')} subtitle={t('page.faq.subtitle')}>
      <FAQSection />
    </PageWrapper>
  );
}

function PageAbout() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.about.title')} subtitle={t('page.about.subtitle')}>
      <AboutSection />
    </PageWrapper>
  );
}

function PagePrivacy() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.privacy.title')} subtitle={t('page.privacy.subtitle')}>
      <PrivacySection />
    </PageWrapper>
  );
}

function PageTerms() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.terms.title')} subtitle={t('page.terms.subtitle')}>
      <ContractSection />
    </PageWrapper>
  );
}

function PageContact() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return (
    <PageWrapper title={t('page.contact.title')} subtitle={t('page.contact.subtitle')}>
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

  // Initialise URL ↔ Store sync (address bar reflects current page)
  useEffect(() => {
    initUrlSync();
  }, []);

  // Minimum loader display — reduced from 1800ms to 600ms for faster LCP.
  // Auth check runs in parallel; once both are done, content appears.
  useEffect(() => {
    const t = setTimeout(() => setMinReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Scroll to top whenever the view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [view]);

  // Restore session from cookie on page load / refresh
  // Also handles Google OAuth callback (?google_login=success)
  // Also handles PipraPay callback (?piprapay=success&pp_id=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleLogin = params.get('google_login');
    const piprapay = params.get('piprapay');
    const ppId = params.get('pp_id');

    const cleanup = () => {
      // Remove query params from URL without full reload
      const url = new URL(window.location.href);
      url.searchParams.delete('google_login');
      url.searchParams.delete('msg');
      url.searchParams.delete('piprapay');
      url.searchParams.delete('pp_id');
      window.history.replaceState({}, '', url.pathname);
    };

    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('no session');
        return res.json() as Promise<UserInfo>;
      })
      .then((user) => {
        setUser(user);
        setTimeout(() => reapplyUrlAfterLogin(), 0);
        if (googleLogin === 'success') {
          toast.success('Google দিয়ে লগইন সফল!');
        }
        if (piprapay === 'success' && ppId) {
          toast.success('পেমেন্ট সফল হয়েছে! ভেরিফিকেশন চলছে...');
          // Auto-verify the payment
          fetch('/api/payment/piprapay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pp_id: ppId }),
          }).then((r) => r.json()).then((d) => {
            if (d.success) toast.success('পেমেন্ট ভেরিফাইড! বিক্রেতা এখন কাজ শুরু করবেন।');
          }).catch(() => {});
        }
        if (piprapay === 'cancel') {
          toast.error('পেমেন্ট বাতিল হয়েছে');
        }
      })
      .catch(() => {
        if (googleLogin === 'error') {
          toast.error('Google লগইন ব্যর্থ হয়েছে');
        }
        if (piprapay === 'success') {
          toast.error('পেমেন্ট ভেরিফিকেশনে সমস্যা — লগইন করুন');
        }
      })
      .finally(() => {
        cleanup();
        setChecking(false);
      });
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
      <DynamicFavicon />
      <LiveSupportButton />
      <SitePopup />
    </div>
  );
}