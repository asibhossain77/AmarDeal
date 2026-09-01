import { create } from 'zustand'
import type { Locale } from '@/lib/i18n'

export type AppView = 'landing' | 'auth' | 'dashboard' | 'seller' | 'admin' | 'blog' | 'page-how-it-works' | 'page-fees' | 'page-security' | 'page-faq' | 'page-about' | 'page-privacy' | 'page-terms' | 'page-contact' | 'page-marketplace' | 'page-seller-profile'
export type DashboardPanel = 'overview' | 'new-deal' | 'my-deals' | 'deal-detail' | 'payment' | 'profile' | 'settings' | 'affiliate' | 'review' | 'seller-add-product' | 'seller-products' | 'seller-orders' | 'seller-business-profile'
/* SellerPanel kept for backward-compat — no longer used as a separate view */
export type SellerPanel = 'overview' | 'new-deal' | 'active-deals' | 'deal-detail' | 'my-products' | 'business-profile' | 'add-product'
export type AdminPanel = 'dashboard' | 'payment-verify' | 'payouts' | 'all-deals' | 'users' | 'settings' | 'payment-methods' | 'fee-rules' | 'contact-info' | 'profile' | 'contract' | 'admin-calls' | 'disputes' | 'blog' | 'email-settings' | 'whatsapp-settings' | 'two-factor' | 'ai-prompt' | 'popup' | 'google-oauth' | 'piprapay' | 'affiliate' | 'affiliate-payouts' | 'marketplace' | 'pending-products'

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
  sellerDisabled: boolean
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
  sellerProfileId: string | null
  /* Navigation history (single-level) */
  _prevView: AppView | null
  _prevDashPanel: DashboardPanel | null
  _prevSellerPanel: SellerPanel | null /* kept for compat, unused */
  setView: (view: AppView) => void
  setUser: (user: UserInfo | null, opts?: { isLogin?: boolean }) => void
  logout: () => void
  setSidebarOpen: (open: boolean) => void
  setDashboardPanel: (panel: DashboardPanel) => void
  setSellerPanel: (panel: SellerPanel) => void /* kept for compat */
  setAdminPanel: (panel: AdminPanel) => void
  setActiveDeal: (deal: DealInfo | null) => void
  setLocale: (locale: Locale) => void
  setSellerProfileId: (id: string | null) => void
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
  sellerProfileId: null,
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
      return set({ user: null, view: 'landing', sidebarOpen: false, dashboardPanel: 'overview', sellerPanel: 'overview', adminPanel: 'dashboard', activeDeal: null })
    }
    // Ensure permissions always has a valid default
    const safeUser = { ...user, permissions: user.permissions ?? [] };
    // Fresh login (isLogin=true): go to landing page; user clicks "শুরু করুন" to enter dashboard
    // Session restore (isLogin=false/undefined): do NOT reset view — app-shell will apply URL
    if (opts?.isLogin) {
      return set({ user: safeUser, view: 'landing', sidebarOpen: false, dashboardPanel: 'overview', sellerPanel: 'overview', adminPanel: 'dashboard', _prevView: null })
    }
    return set({ user: safeUser })
  },
  logout: () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    set({ user: null, view: 'landing', sidebarOpen: false, dashboardPanel: 'overview', sellerPanel: 'overview', adminPanel: 'dashboard', activeDeal: null });
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
  setSellerProfileId: (sellerProfileId) => set({ sellerProfileId }),
  goBack: () => set((s) => {
    // Priority: panel-level back → view-level back
    if (s.view === 'dashboard' && s._prevDashPanel) {
      let target: DashboardPanel = s._prevDashPanel;
      // Skip deal-detail / payment / seller-order-detail
      if (target === 'deal-detail' || target === 'payment') {
        target = 'overview';
      }
      // Avoid going to the same panel we're already on (prevents loops)
      if (target === s.dashboardPanel) {
        target = 'overview';
      }
      return { dashboardPanel: target, _prevDashPanel: null };
    }
    if (s._prevView) {
      const target = s._prevView;
      return { view: target, _prevView: null, sidebarOpen: false };
    }
    return { view: 'landing', sidebarOpen: false };
  }),
  navigateToDashboard: () => set((s) => {
    if (!s.user) return { view: 'auth' };
    if (s.user.isAdmin) return { view: 'admin', adminPanel: 'dashboard', sidebarOpen: false, _prevView: 'landing' };
    if (s.user.isSeller) return { view: 'dashboard', dashboardPanel: 'overview', sidebarOpen: false, _prevView: 'landing' };
    return { view: 'dashboard', dashboardPanel: 'overview', sidebarOpen: false, _prevView: 'landing' };
  }),
}))