/* ═══════════════════════════════════════════════════════════════
   URL ↔ Store Sync
   Keeps the browser address bar in sync with Zustand state
   and handles browser back / forward / direct URL access.
   ═══════════════════════════════════════════════════════════════ */

import { useAppStore, type AppView, type DashboardPanel, type SellerPanel, type AdminPanel } from './store';

/* ── View → URL segment maps ── */

const VIEW_PATHS: Record<string, string> = {
  'landing': '',
  'auth': 'login',
  'dashboard': 'dashboard',
  'seller': 'seller',
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
};

const PATH_VIEWS: Record<string, AppView> = {
  'login': 'auth',
  'dashboard': 'dashboard',
  'seller': 'seller',
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
};

/* ── Build URL from store state ── */

export function buildUrl(state: {
  view: AppView;
  dashboardPanel: DashboardPanel;
  sellerPanel: SellerPanel;
  adminPanel: AdminPanel;
  activeDeal: { id: string } | null;
}): string {
  const { view, dashboardPanel, sellerPanel, adminPanel, activeDeal } = state;

  // Static pages
  const viewPath = VIEW_PATHS[view];
  if (viewPath !== undefined && view !== 'dashboard' && view !== 'seller' && view !== 'admin') {
    return '/' + viewPath;
  }

  // Dashboard sub-panels
  if (view === 'dashboard') {
    if (dashboardPanel === 'deal-detail' && activeDeal?.id) {
      return `/dashboard/deals/${activeDeal.id}`;
    }
    return dashboardPanel === 'overview' ? '/dashboard' : `/dashboard/${dashboardPanel}`;
  }

  // Seller sub-panels
  if (view === 'seller') {
    if (sellerPanel === 'deal-detail' && activeDeal?.id) {
      return `/seller/deals/${activeDeal.id}`;
    }
    const map: Record<string, string> = { 'my-products': 'products' };
    const panelPath = map[sellerPanel] || sellerPanel;
    return panelPath === 'overview' ? '/seller' : `/seller/${panelPath}`;
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
  sellerPanel: SellerPanel | null;
  adminPanel: AdminPanel | null;
  dealId: string | null;
}

export function parseUrl(pathname: string): ParsedUrl {
  const result: ParsedUrl = {
    view: null, dashboardPanel: null, sellerPanel: null, adminPanel: null, dealId: null,
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

  const [seg1, seg2] = segments;

  if (seg1 === 'dashboard') {
    result.view = 'dashboard';
    if (seg2 === 'deals' && segments[2]) {
      result.dashboardPanel = 'deal-detail';
      result.dealId = segments[2];
    } else {
      const valid: DashboardPanel[] = ['overview', 'new-deal', 'my-deals', 'deal-detail', 'payment', 'profile', 'settings'];
      result.dashboardPanel = valid.includes(seg2 as DashboardPanel) ? seg2 as DashboardPanel : 'overview';
    }
    return result;
  }

  if (seg1 === 'seller') {
    result.view = 'seller';
    if (seg2 === 'deals' && segments[2]) {
      result.sellerPanel = 'deal-detail';
      result.dealId = segments[2];
    } else {
      const reverse: Record<string, SellerPanel> = { 'products': 'my-products' };
      const panel = reverse[seg2] || seg2;
      const valid: SellerPanel[] = ['overview', 'active-deals', 'deal-detail', 'my-products'];
      result.sellerPanel = valid.includes(panel as SellerPanel) ? panel as SellerPanel : 'overview';
    }
    return result;
  }

  if (seg1 === 'admin') {
    result.view = 'admin';
    const valid: AdminPanel[] = [
      'dashboard', 'payment-verify', 'payouts', 'all-deals', 'users',
      'settings', 'payment-methods', 'fee-rules', 'contact-info',
      'profile', 'contract', 'admin-calls', 'disputes', 'blog', 'email-settings',
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

const STATIC_VIEWS = new Set(['blog', 'page-how-it-works', 'page-fees', 'page-security', 'page-faq', 'page-about', 'page-privacy', 'page-terms', 'page-contact']);

function applyUrlToStore() {
  const store = useAppStore;
  const parsed = parseUrl(window.location.pathname);
  const state = store.getState();
  const updates: Record<string, unknown> = {};

  // Guard: if user is logged in, prevent navigating to auth/landing via browser back
  if (state.user && (parsed.view === 'auth' || parsed.view === 'landing')) {
    // Replace the history entry with the correct URL for current view
    const correctUrl = buildUrl(state);
    if (correctUrl !== window.location.pathname) {
      window.history.replaceState(null, '', correctUrl);
    }
    _lastUrl = window.location.pathname;
    return;
  }

  if (parsed.view && parsed.view !== state.view) updates.view = parsed.view;
  if (parsed.dashboardPanel && state.view === 'dashboard' && parsed.dashboardPanel !== state.dashboardPanel) updates.dashboardPanel = parsed.dashboardPanel;
  if (parsed.sellerPanel && state.view === 'seller' && parsed.sellerPanel !== state.sellerPanel) updates.sellerPanel = parsed.sellerPanel;
  if (parsed.adminPanel && state.view === 'admin' && parsed.adminPanel !== state.adminPanel) updates.adminPanel = parsed.adminPanel;

  if (Object.keys(updates).length > 0) {
    store.setState(updates);
  }

  _lastUrl = window.location.pathname;
}

/** Can be called after login to re-apply the URL without re-subscribing */
export function reapplyUrlAfterLogin() {
  if (typeof window === 'undefined') return;
  const store = useAppStore;
  const state = store.getState();
  const correctUrl = buildUrl(state);
  // Use replaceState to remove /login from history, preventing back-to-login
  window.history.replaceState(null, '', correctUrl);
  _lastUrl = correctUrl;
}

/* ── One-time init: subscribe + popstate ── */

let _initDone = false;

export function initUrlSync() {
  if (_initDone || typeof window === 'undefined') return;
  _initDone = true;

  const store = useAppStore;

  // 1. On mount: parse current URL and apply to store
  const parsed = parseUrl(window.location.pathname);
  const state = store.getState();

  if (state.user) {
    // Logged in — apply full URL
    applyUrlToStore();
  } else if (parsed.view && STATIC_VIEWS.has(parsed.view)) {
    // Not logged in but on a public page
    store.setState({ view: parsed.view });
    _lastUrl = window.location.pathname;
  } else {
    _lastUrl = window.location.pathname;
  }

  // 2. Subscribe to store changes → update URL
  store.subscribe((s) => {
    pushUrl(buildUrl(s));
  });

  // 3. Handle browser back / forward
  window.addEventListener('popstate', () => {
    _lastUrl = window.location.pathname;
    applyUrlToStore();
  });
}