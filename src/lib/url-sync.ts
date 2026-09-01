/* ═══════════════════════════════════════════════════════════════
   URL ↔ Store Sync
   Keeps the browser address bar in sync with Zustand state
   and handles browser back / forward / direct URL access.
   ═══════════════════════════════════════════════════════════════ */

import { useAppStore, type AppView, type DashboardPanel, type AdminPanel } from './store';

/* ── View → URL segment maps ── */

const VIEW_PATHS: Record<string, string> = {
  'landing': '',
  'auth': 'login',
  'dashboard': 'dashboard',
  'admin': 'admin',
  'blog': 'blog',
  'page-how-it-works': 'how-it-works',
  'page-fees': 'fees',
  'page-security': 'security',
  'page-faq': 'faq',
  'page-about': 'about',
  'page-privacy': 'privacy',
  'page-terms': 'terms',
  'page-contact': 'contact',
  'page-marketplace': 'marketplace',
  'page-seller-profile': 's/__SELLER_ID__',
};

const PATH_VIEWS: Record<string, AppView> = {
  'login': 'auth',
  'dashboard': 'dashboard',
  'admin': 'admin',
  'blog': 'blog',
  'how-it-works': 'page-how-it-works',
  'fees': 'page-fees',
  'security': 'page-security',
  'faq': 'page-faq',
  'about': 'page-about',
  'privacy': 'page-privacy',
  'terms': 'page-terms',
  'contact': 'page-contact',
  'marketplace': 'page-marketplace',
};

/* ── Build URL from store state ── */

export function buildUrl(state: {
  view: AppView;
  dashboardPanel: DashboardPanel;
  adminPanel: AdminPanel;
  activeDeal: { id: string } | null;
  sellerProfileId?: string | null;
}): string {
  const { view, dashboardPanel, adminPanel, activeDeal, sellerProfileId } = state;

  // Seller public profile
  if (view === 'page-seller-profile' && sellerProfileId) {
    return `/s/${sellerProfileId}`;
  }

  // Static pages
  const viewPath = VIEW_PATHS[view];
  if (viewPath !== undefined && view !== 'dashboard' && view !== 'admin') {
    return '/' + viewPath;
  }

  // Dashboard sub-panels (includes seller panels)
  if (view === 'dashboard') {
    if (dashboardPanel === 'deal-detail' && activeDeal?.id) {
      return `/dashboard/deals/${activeDeal.id}`;
    }
    return dashboardPanel === 'overview' ? '/dashboard' : `/dashboard/${dashboardPanel}`;
  }

  // Admin sub-panels
  if (view === 'admin') {
    return adminPanel === 'dashboard' ? '/admin' : `/admin/${adminPanel}`;
  }

  return '/';
}

/* ── Parse URL → partial store state ── */

interface ParsedUrl {
  view: AppView | null;
  dashboardPanel: DashboardPanel | null;
  adminPanel: AdminPanel | null;
  dealId: string | null;
  sellerId: string | null;
}

export function parseUrl(pathname: string): ParsedUrl {
  const result: ParsedUrl = {
    view: null, dashboardPanel: null, adminPanel: null, dealId: null, sellerId: null,
  };

  const p = pathname.replace(/\/+$/, '') || '/';

  if (p === '/') { result.view = 'landing'; return result; }

  const segments = p.split('/').filter(Boolean);
  if (segments.length === 0) { result.view = 'landing'; return result; }

  // Single segment
  if (segments.length === 1) {
    const view = PATH_VIEWS[segments[0]];
    if (view) { result.view = view; return result; }
    result.view = 'landing';
    return result;
  }

  // /s/[sellerId] — seller public profile
  if (segments.length === 2 && segments[0] === 's') {
    result.view = 'page-seller-profile';
    result.sellerId = segments[1];
    return result;
  }

  const [seg1, seg2] = segments;

  if (seg1 === 'dashboard') {
    result.view = 'dashboard';
    if (seg2 === 'deals' && segments[2]) {
      result.dashboardPanel = 'deal-detail';
      result.dealId = segments[2];
    } else if (seg2 === 'seller-orders' && segments[2]) {
      result.dashboardPanel = 'deal-detail';
      result.dealId = segments[2];
    } else {
      const valid: DashboardPanel[] = ['overview', 'new-deal', 'my-deals', 'deal-detail', 'payment', 'profile', 'settings', 'affiliate', 'review', 'seller-orders', 'seller-products', 'seller-add-product', 'seller-business-profile'];
      result.dashboardPanel = valid.includes(seg2 as DashboardPanel) ? seg2 as DashboardPanel : 'overview';
    }
    return result;
  }

  // Legacy /seller/* URLs → redirect to /dashboard/seller-*
  if (seg1 === 'seller') {
    result.view = 'dashboard';
    if (seg2 === 'deals' && segments[2]) {
      result.dashboardPanel = 'deal-detail';
      result.dealId = segments[2];
    } else if (seg2 === 'products') {
      result.dashboardPanel = 'seller-products';
    } else if (seg2 === 'active-deals') {
      result.dashboardPanel = 'seller-orders';
    } else if (seg2 === 'add-product') {
      result.dashboardPanel = 'seller-add-product';
    } else if (seg2 === 'business-profile') {
      result.dashboardPanel = 'seller-business-profile';
    } else {
      result.dashboardPanel = 'seller-orders';
    }
    return result;
  }

  if (seg1 === 'admin') {
    result.view = 'admin';
    const valid: AdminPanel[] = [
      'dashboard', 'payment-verify', 'payouts', 'all-deals', 'users',
      'settings', 'payment-methods', 'fee-rules', 'contact-info',
      'profile', 'contract', 'admin-calls', 'disputes', 'blog', 'email-settings',
      'whatsapp-settings',
      'two-factor', 'ai-prompt', 'popup', 'google-oauth', 'piprapay', 'affiliate',
      'affiliate-payouts',
    ];
    result.adminPanel = valid.includes(seg2 as AdminPanel) ? seg2 as AdminPanel : 'dashboard';
    return result;
  }

  result.view = 'landing';
  return result;
}

/* ── Push URL without reload ── */

let _lastUrl = '';

function pushUrl(url: string) {
  const full = url || '/';
  if (full === _lastUrl) return;
  _lastUrl = full;
  window.history.pushState(null, '', full);
}

/* ── Apply current URL to store (reusable) ── */

const STATIC_VIEWS = new Set(['blog', 'page-how-it-works', 'page-fees', 'page-security', 'page-faq', 'page-about', 'page-privacy', 'page-terms', 'page-contact', 'page-marketplace', 'page-seller-profile']);
const PROTECTED_VIEWS = new Set(['admin', 'dashboard', 'auth']);

function applyUrlToStore() {
  const store = useAppStore;
  const parsed = parseUrl(window.location.pathname);
  const state = store.getState();
  const updates: Record<string, unknown> = {};

  // Handle legacy /seller/* URLs: replace in browser history
  if (window.location.pathname.startsWith('/seller')) {
    const correctUrl = buildUrl({ view: 'dashboard', dashboardPanel: parsed.dashboardPanel || 'overview', adminPanel: state.adminPanel, activeDeal: parsed.dealId ? { id: parsed.dealId } : null });
    window.history.replaceState(null, '', correctUrl);
    _lastUrl = correctUrl;
  }

  // Guard: if user is logged in, prevent navigating to auth via browser back
  // But allow landing page access for logged-in users
  if (state.user && parsed.view === 'auth') {
    const correctUrl = buildUrl(state);
    if (correctUrl !== window.location.pathname) {
      window.history.replaceState(null, '', correctUrl);
    }
    _lastUrl = window.location.pathname;
    return;
  }

  if (parsed.view && parsed.view !== state.view) updates.view = parsed.view;
  if (parsed.sellerId) updates.sellerProfileId = parsed.sellerId;
  if (parsed.dashboardPanel && state.view === 'dashboard' && parsed.dashboardPanel !== state.dashboardPanel) updates.dashboardPanel = parsed.dashboardPanel;
  if (parsed.adminPanel && state.view === 'admin' && parsed.adminPanel !== state.adminPanel) updates.adminPanel = parsed.adminPanel;

  if (Object.keys(updates).length > 0) {
    store.setState(updates);
  }

  _lastUrl = window.location.pathname;
}

/** Can be called after fresh login to set correct URL */
export function reapplyUrlAfterLogin() {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', '/');
  _lastUrl = '/';
}

/* ── Auth restoration flag ── */
/**
 * When true, the store→URL subscriber is blocked so that
 * setUser() (which resets view to 'landing') doesn't overwrite
 * the real URL the user was on before the refresh.
 */
let _authRestoring = false;

/** Called after session restore (page refresh) — apply URL to store without redirecting */
export function applyUrlAfterAuth() {
  if (typeof window === 'undefined') return;

  // Use the saved URL (from initUrlSync) instead of window.location.pathname
  // because the subscriber may have already pushed '/' during setUser().
  const savedPath = _preAuthUrl || window.location.pathname;
  const parsed = parseUrl(savedPath);
  const store = useAppStore;
  const state = store.getState();
  const updates: Record<string, unknown> = {};

  // If URL is a protected view, apply it to store
  if (parsed.view && PROTECTED_VIEWS.has(parsed.view) && parsed.view !== 'auth') {
    updates.view = parsed.view;
    if (parsed.dashboardPanel) updates.dashboardPanel = parsed.dashboardPanel;
    if (parsed.adminPanel) updates.adminPanel = parsed.adminPanel;
    if (parsed.dealId) updates.activeDeal = { id: parsed.dealId };
  } else if (parsed.view && STATIC_VIEWS.has(parsed.view)) {
    updates.view = parsed.view;
    if (parsed.sellerId) updates.sellerProfileId = parsed.sellerId;
  }

  if (Object.keys(updates).length > 0) {
    store.setState(updates);
  }

  // Restore the correct URL if the subscriber overwrote it
  if (savedPath !== window.location.pathname) {
    window.history.replaceState(null, '', savedPath);
  }

  _lastUrl = savedPath;
  _preAuthUrl = '';
  _authRestoring = false;
}

/* ── One-time init: subscribe + popstate ── */

let _initDone = false;
let _preAuthUrl = '';

export function initUrlSync() {
  if (_initDone || typeof window === 'undefined') return;
  _initDone = true;

  const store = useAppStore;

  // 1. On mount: parse current URL and apply to store
  const parsed = parseUrl(window.location.pathname);
  const state = store.getState();

  if (parsed.view === 'auth' && !state.user) {
    store.setState({ view: 'auth' });
    _lastUrl = window.location.pathname;
  } else if (state.user) {
    if (parsed.view === 'landing' || parsed.view === null) {
      _lastUrl = window.location.pathname;
    } else {
      applyUrlToStore();
    }
  } else if (parsed.view && STATIC_VIEWS.has(parsed.view)) {
    store.setState({ view: parsed.view });
    _lastUrl = window.location.pathname;
  } else if (parsed.view && PROTECTED_VIEWS.has(parsed.view)) {
    // Not logged in yet but on a protected URL — page refresh scenario.
    // Save the URL so applyUrlAfterAuth() can use it even if the
    // store subscriber overwrites window.location before auth completes.
    _preAuthUrl = window.location.pathname;
    _authRestoring = true;
    _lastUrl = window.location.pathname;
  } else {
    _lastUrl = window.location.pathname;
  }

  // 2. Subscribe to store changes → update URL
  store.subscribe((s) => {
    // Block URL pushes during auth restoration to prevent
    // setUser() from pushing '/' while the real URL is /admin/...
    if (_authRestoring) return;
    pushUrl(buildUrl(s));
  });

  // 3. Handle browser back / forward
  window.addEventListener('popstate', () => {
    _lastUrl = window.location.pathname;
    applyUrlToStore();
  });
}
