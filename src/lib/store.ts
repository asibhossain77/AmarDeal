import { create } from 'zustand'
import type { Locale } from '@/lib/i18n'
import { isAppDomain, isLandingDomain } from '@/lib/domain'

export type AppView = 'landing' | 'auth' | 'dashboard' | 'seller' | 'admin' | 'blog' | 'page-how-it-works' | 'page-fees' | 'page-security' | 'page-faq' | 'page-about' | 'page-privacy' | 'page-terms' | 'page-contact'
export type DashboardPanel = 'overview' | 'new-deal' | 'my-deals' | 'deal-detail' | 'payment' | 'profile' | 'settings' | 'affiliate' | 'review'
export type SellerPanel = 'overview' | 'active-deals' | 'deal-detail' | 'my-products'
export type AdminPanel = 'dashboard' | 'payment-verify' | 'payouts' | 'all-deals' | 'users' | 'settings' | 'payment-methods' | 'fee-rules' | 'contact-info' | 'profile' | 'contract' | 'admin-calls' | 'disputes' | 'blog' | 'email-settings' | 'two-factor' | 'ai-prompt' | 'popup' | 'google-oauth' | 'piprapay' | 'affiliate' | 'affiliate-payouts'

/** All possible deal statuses in the escrow flow */
export type DealStatus =
  | 'created'
  | 'payment_pending'
  | 'payment_verified'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'rejected'

export interface UserInfo {
  id: string
  name: string
  email: string
  phone: string
  isAdmin: boolean
  adminRole: string | null
  permissions: string[]
  isSeller: boolean
  imageLink?: string | null
}

interface DealInfo {
  id: string
  title: string
  amount: number
  status: DealStatus
  createdAt: string
  buyerId?: string
  sellerId?: string
  creatorId?: string
  buyerName?: string
  sellerName?: string
  rejectionReason?: string | null
}

interface AppState {
  view: AppView
  user: UserInfo | null
  sidebarOpen: boolean
  dashboardPanel: DashboardPanel
  sellerPanel: SellerPanel
  adminPanel: AdminPanel
  activeDeal: DealInfo | null
  locale: Locale
  /* Navigation history (single-level) */
  _prevView: AppView | null
  _prevDashPanel: DashboardPanel | null
  _prevSellerPanel: SellerPanel | null
  setView: (view: AppView) => void
  setUser: (user: UserInfo | null, opts?: { isLogin?: boolean }) => void
  logout: () => void
  setSidebarOpen: (open: boolean) => void
  setDashboardPanel: (panel: DashboardPanel) => void
  setSellerPanel: (panel: SellerPanel) => void
  setAdminPanel: (panel: AdminPanel) => void
  setActiveDeal: (deal: DealInfo | null) => void
  setLocale: (locale: Locale) => void
  /** Go back to previous page/panel */
  goBack: () => void
  /** Navigate to the user's main view (dashboard, seller, or admin) */
  navigateToDashboard: () => void
}

/* Persist locale in localStorage */
function getSavedLocale(): Locale {
  if (typeof window === 'undefined') return 'bn';
  return (localStorage.getItem('midman-locale') as Locale) || 'bn';
}

export const useAppStore = create<AppState>((set) => ({
  view: 'landing',
  user: null,
  sidebarOpen: false,
  dashboardPanel: 'overview',
  sellerPanel: 'overview',
  adminPanel: 'dashboard',
  activeDeal: null,
  locale: getSavedLocale(),
  _prevView: null,
  _prevDashPanel: null,
  _prevSellerPanel: null,
  setView: (view) => set((s) => ({
    _prevView: s.view !== view ? s.view : s._prevView,
    view,
    sidebarOpen: false,
  })),
  setUser: (user, opts) => {
    if (!user) {
      // On app domain, logout goes to auth; on landing domain, stay on landing
      const resetView = isAppDomain() ? 'auth' as const : 'landing' as const;
      return set({ user: null, view: resetView, sidebarOpen: false, dashboardPanel: 'overview', sellerPanel: 'overview', adminPanel: 'dashboard', activeDeal: null })
    }
    // Ensure permissions always has a valid default
    const safeUser = { ...user, permissions: user.permissions ?? [] };
    // Fresh login (isLogin=true):
    //   - On landing domain: go to landing page; user clicks "শুরু করুন" to enter dashboard
    //   - On app domain: go directly to dashboard/seller/admin
    // Session restore (isLogin=false/undefined): do NOT reset view — app-shell will apply URL
    if (opts?.isLogin) {
      if (isAppDomain()) {
        // On app domain, go directly to the user's main view
        let targetView: AppView = 'dashboard';
        if (safeUser.isAdmin) targetView = 'admin';
        else if (safeUser.isSeller) targetView = 'seller';
        return set({ user: safeUser, view: targetView, sidebarOpen: false, dashboardPanel: 'overview', sellerPanel: 'overview', adminPanel: 'dashboard', _prevView: null })
      }
      return set({ user: safeUser, view: 'landing', sidebarOpen: false, dashboardPanel: 'overview', sellerPanel: 'overview', adminPanel: 'dashboard', _prevView: null })
    }
    return set({ user: safeUser })
  },
  logout: () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    // On app domain, go to auth page; on landing domain, stay on landing
    const resetView = isAppDomain() ? 'auth' as const : 'landing' as const;
    set({ user: null, view: resetView, sidebarOpen: false, dashboardPanel: 'overview', sellerPanel: 'overview', adminPanel: 'dashboard', activeDeal: null });
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setDashboardPanel: (dashboardPanel) => set((s) => ({
    _prevDashPanel: s.dashboardPanel !== dashboardPanel ? s.dashboardPanel : s._prevDashPanel,
    dashboardPanel,
  })),
  setSellerPanel: (sellerPanel) => set((s) => ({
    _prevSellerPanel: s.sellerPanel !== sellerPanel ? s.sellerPanel : s._prevSellerPanel,
    sellerPanel,
  })),
  setAdminPanel: (adminPanel) => set({ adminPanel, sidebarOpen: false }),
  setActiveDeal: (activeDeal) => set({ activeDeal }),
  setLocale: (locale) => {
    localStorage.setItem('midman-locale', locale);
    document.documentElement.lang = locale === 'bn' ? 'bn' : 'en';
    set({ locale });
  },
  goBack: () => set((s) => {
    // Priority: panel-level back → view-level back
    if (s.view === 'dashboard' && s._prevDashPanel) {
      let target: DashboardPanel = s._prevDashPanel;
      // Skip deal-detail / payment — redirect to my-deals or overview
      if (target === 'deal-detail' || target === 'payment') {
        target = 'my-deals';
      }
      // Avoid going to the same panel we're already on (prevents loops)
      if (target === s.dashboardPanel) {
        target = 'overview';
      }
      return { dashboardPanel: target, _prevDashPanel: null };
    }
    if (s.view === 'seller' && s._prevSellerPanel) {
      let target: SellerPanel = s._prevSellerPanel;
      if (target === 'deal-detail') {
        target = 'active-deals';
      }
      if (target === s.sellerPanel) {
        target = 'overview';
      }
      return { sellerPanel: target, _prevSellerPanel: null };
    }
    if (s._prevView) {
      const target = s._prevView;
      return { view: target, _prevView: null, sidebarOpen: false };
    }
    // On app domain, goBack from root goes to auth; on landing, stay on landing
    const fallback = isAppDomain() ? 'auth' as const : 'landing' as const;
    return { view: fallback, sidebarOpen: false };
  }),
  navigateToDashboard: () => set((s) => {
    if (!s.user) return { view: 'auth' };
    if (s.user.isAdmin) return { view: 'admin', adminPanel: 'dashboard', sidebarOpen: false, _prevView: 'landing' };
    if (s.user.isSeller) return { view: 'seller', sellerPanel: 'overview', sidebarOpen: false, _prevView: 'landing' };
    return { view: 'dashboard', dashboardPanel: 'overview', sidebarOpen: false, _prevView: 'landing' };
  }),
}))