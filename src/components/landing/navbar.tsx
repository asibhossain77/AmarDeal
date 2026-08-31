'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useAppStore, type DashboardPanel, type AdminPanel } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useTranslation } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Menu,
  Sun,
  Moon,
  LogIn,
  LayoutDashboard,
  FilePlus,
  LogOut,
  Handshake,
  ArrowLeftRight,
  UserCircle,
  ShieldCheck,
  CreditCard,
  Users,
  Settings,
  Receipt,
  MessageCircle,
  FileText,
  Headphones,
  BookOpen,
  Sparkles,
  Calculator,
  ListChecks,
  CircleHelp,
  Mail,
  MessageSquare,
  Bell,
  Store,
} from 'lucide-react';
import { SellerApplyButton } from '@/components/dashboard/seller-apply-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cdnUrl } from '@/lib/cdn-url';

const emptySubscribe = () => () => {};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <button className="flex h-9 w-9 items-center justify-center rounded-lg" aria-label={t('nav.themeChange')}>
        <span className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={t('nav.themeChange')}
    >
      {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

function LogoButton({ onClick }: { onClick: () => void }) {
  const { siteName, siteNameEn, siteLogo } = useSiteSettings();
  const locale = useAppStore((s) => s.locale);
  const displayName = locale === 'en' ? siteNameEn : siteName;
  return (
    <button onClick={onClick} className="flex items-center gap-2.5">
      {siteLogo ? (
        <img
          src={cdnUrl(siteLogo) || ''}
          alt={displayName}
          fetchPriority="high"
          className="h-9 w-9 rounded-lg object-contain"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <span className="text-sm font-bold text-primary">{displayName?.charAt(0) || 'M'}</span>
        </div>
      )}
      <span className="text-lg font-bold tracking-tight text-foreground">{displayName}</span>
    </button>
  );
}

function MobileBrandHeader({ sub }: { sub?: string }) {
  const { siteName, siteNameEn, siteLogo } = useSiteSettings();
  const locale = useAppStore((s) => s.locale);
  const displayName = locale === 'en' ? siteNameEn : siteName;
  return (
    <div className="mb-4 flex items-center gap-2.5 px-1">
      {siteLogo ? (
        <img
          src={cdnUrl(siteLogo) || ''}
          alt={displayName}
          fetchPriority="high"
          className="h-9 w-9 rounded-lg object-contain"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <span className="text-sm font-bold text-primary">{displayName?.charAt(0) || 'M'}</span>
        </div>
      )}
      {sub ? (
        <div>
          <p className="text-base font-bold tracking-tight text-foreground">{displayName}</p>
          <p className="text-[10px] font-semibold tracking-widest text-primary">{sub}</p>
        </div>
      ) : (
        <p className="text-base font-bold tracking-tight text-foreground">{displayName}</p>
      )}
    </div>
  );
}

/* ── Translated nav helpers ── */
function useNavText() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  return t;
}

/* ── Dashboard mobile nav items (mirrors sidebar) ── */
function useDashboardNavItems() {
  const t = useNavText();
  return [
    { label: t('nav.dashboard'), icon: LayoutDashboard, panel: 'overview' },
    { label: t('nav.myDeals'), icon: Handshake, panel: 'my-deals' },
    { label: t('nav.transactions'), icon: ArrowLeftRight, panel: 'payment' },
    { label: t('nav.profile'), icon: UserCircle, panel: 'profile' },
    { label: t('nav.affiliate'), icon: Users, panel: 'affiliate' },
    { label: t('nav.review'), icon: MessageSquare, panel: 'review' },
    { label: t('nav.settings'), icon: Settings, panel: 'settings' },
  ];
}

/* ── Admin mobile nav items (mirrors sidebar) ── */
function useAdminNavItems() {
  const t = useNavText();
  return [
    { label: t('adminNav.dashboard'), icon: LayoutDashboard, panel: 'dashboard' },
    { label: t('adminNav.paymentVerify'), icon: ShieldCheck, panel: 'payment-verify' },
    { label: t('adminNav.liveChat'), icon: Headphones, panel: 'admin-calls' },
    { label: t('adminNav.paymentMethods'), icon: CreditCard, panel: 'payment-methods' },
    { label: t('adminNav.feeRules'), icon: Receipt, panel: 'fee-rules' },
    { label: t('adminNav.affiliate'), icon: Users, panel: 'affiliate' },
    { label: t('adminNav.allDeals'), icon: Handshake, panel: 'all-deals' },
    { label: t('adminNav.userManagement'), icon: Users, panel: 'users' },
    { label: t('adminNav.contact'), icon: MessageCircle, panel: 'contact-info' },
    { label: t('adminNav.websiteSettings'), icon: Settings, panel: 'settings' },
    { label: t('adminNav.contract'), icon: FileText, panel: 'contract' },
    { label: t('adminNav.blog'), icon: BookOpen, panel: 'blog' },
    { label: t('adminNav.push'), icon: Bell, panel: 'push' },
  ];
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { view, user, logout, setView, setDashboardPanel, setAdminPanel, dashboardPanel, adminPanel, activeDeal, navigateToDashboard } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useNavText();

  const isAdmin = view === 'admin';
  const isAuth = view === 'auth' || view === 'dashboard';
  const isDashboard = view === 'dashboard' && user;
  const isSidebarView = isDashboard || isAdmin;

  const isInfoPage = view === 'blog' || view.startsWith('page-');

  const dashboardNavItems = useDashboardNavItems();
  const adminNavItems = useAdminNavItems();

  const handleLogoClick = () => {
    if (isDashboard) setDashboardPanel('overview');
    else if (isAdmin) setAdminPanel('dashboard');
    else setView('landing');
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    logout();
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <nav
        className={`relative h-16 items-center justify-between px-4 sm:px-6 ${
          isSidebarView ? 'flex md:pl-0' : 'mx-auto flex max-w-6xl md:px-8'
        }`}
      >
        {/* ── Desktop: Logo aligned with sidebar (dashboard / admin) ── */}
        {isSidebarView && (
          <div className="hidden md:flex md:w-64 md:shrink-0 md:pl-5">
            <LogoButton onClick={handleLogoClick} />
          </div>
        )}

        {/* ── Main content area ── */}
        <div
          className={`flex items-center ${
            isSidebarView
              ? 'flex-1 md:justify-end md:px-0'
              : ''
          }`}
        >
          {/* Landing / Auth logo */}
          {!isSidebarView && <LogoButton onClick={handleLogoClick} />}

          {/* Mobile-only logo for dashboard / admin */}
          {isSidebarView && (
            <div className="md:hidden">
              <LogoButton onClick={handleLogoClick} />
            </div>
          )}

          {/* ── Desktop Nav: Dashboard ── */}
          {isDashboard && mounted && (
            <div className="hidden items-center gap-1.5 md:flex">
              <button
                onClick={() => setDashboardPanel('overview')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
                aria-label={t('nav.dashboard')}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden xl:inline">{t('nav.dashboard')}</span>
              </button>
              <button
                onClick={() => setDashboardPanel('new-deal')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary bg-primary/10 transition-colors hover:bg-primary/15"
                aria-label={t('nav.newDeal')}
              >
                <FilePlus className="h-4 w-4" />
                <span className="hidden xl:inline">{t('nav.newDeal')}</span>
              </button>
              <div className="mx-1 h-5 w-px bg-border/60" />
              <LanguageSwitcher />
              <ThemeToggle />
              <button
                onClick={() => setDashboardPanel('profile')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary hover:bg-primary/25 transition-colors"
                aria-label={t('nav.profile')}
              >
                {user?.name?.charAt(0) || 'U'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                aria-label={t('nav.logout')}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden xl:inline">{t('nav.logout')}</span>
              </button>
            </div>
          )}

          {/* ── Desktop Nav: Admin ── */}
          {isAdmin && mounted && (
            <div className="hidden items-center gap-2 md:flex">
              <LanguageSwitcher />
              <ThemeToggle />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">A</div>
              <button
                onClick={() => setView('dashboard')}
                className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                {t('nav.exitAdmin')}
              </button>
            </div>
          )}
        </div>

        {/* ── Center: Landing Desktop Nav Links (icons only + tooltip on hover) ── */}
        {!isSidebarView && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden items-center gap-1 md:flex">
            {[
              { href: '/security', viewKey: 'page-security', label: t('nav.features'), Icon: Sparkles },
              { href: '/fees', viewKey: 'page-fees', label: t('nav.feeStructure'), Icon: Calculator },
              { href: '/how-it-works', viewKey: 'page-how-it-works', label: t('nav.howItWorks'), Icon: ListChecks },
              { href: '/marketplace', viewKey: 'page-marketplace', label: t('nav.marketplace'), Icon: Store },
              { href: '/faq', viewKey: 'page-faq', label: t('nav.faq'), Icon: CircleHelp },
              { href: '/blog', viewKey: 'blog', label: t('nav.blog'), Icon: BookOpen },
              { href: '/about', viewKey: 'page-about', label: t('nav.about'), Icon: Users },
              { href: '/contact', viewKey: 'page-contact', label: t('nav.contact'), Icon: Mail },
            ].map((item) => (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <a
                    href={item.href}
                    onClick={(e) => { e.preventDefault(); setView(item.viewKey); }}
                    aria-label={item.label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
                  >
                    <item.Icon className="h-[18px] w-[18px]" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* ── Right: Landing Desktop Buttons (direct child of nav) ── */}
        {!isSidebarView && (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
            {user ? (
              <Button size="sm" onClick={() => navigateToDashboard()} className="gap-2 rounded-lg font-medium shadow-md shadow-primary/20">
                <LayoutDashboard className="h-4 w-4" />
                {t('hero.startNow')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setView('auth')} className="gap-2 rounded-lg font-medium shadow-md shadow-primary/20">
                <LogIn className="h-4 w-4" />
                {t('nav.loginRegister')}
              </Button>
            )}
          </div>
        )}

        {/* ── Mobile Menu (hamburger for landing/auth/dashboard — admin has its own) ── */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <ThemeToggle />
            {!isAdmin && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={t('nav.openMenu')}>
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 overflow-y-auto">
                <SheetTitle className="sr-only">{t('nav.navMenu')}</SheetTitle>
                <nav className="flex flex-col gap-1 pt-8">
                  {/* ── Dashboard Mobile Nav ── */}
                  {isDashboard && (
                    <>
                      {/* Brand Header */}
                      <MobileBrandHeader sub="DASHBOARD" />

                      {/* CTA: New Deal */}
                      <button
                        onClick={() => { setDashboardPanel('new-deal'); setOpen(false); }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
                      >
                        <FilePlus className="h-4 w-4" />
                        {t('nav.createNewDeal')}
                      </button>

                      <div className="my-2 h-px bg-border/60" />

                      {/* Nav Items */}
                      {dashboardNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = dashboardPanel === item.panel;
                        return (
                          <button
                            key={item.label}
                            onClick={() => {
                              if (item.panel === 'my-deals' && activeDeal) {
                                setDashboardPanel('deal-detail');
                              } else {
                                setDashboardPanel(item.panel as DashboardPanel);
                              }
                              setOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                              isActive
                                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                            {item.label}
                          </button>
                        );
                      })}

                      {!user?.isAdmin && (
                        <div className="mt-1">
                          <SellerApplyButton variant="mobile" onClose={() => setOpen(false)} />
                        </div>
                      )}

                      {/* User Info */}
                      <div className="my-2 border-t border-border/50 pt-3">
                        <div className="flex items-center gap-3 rounded-xl px-4 py-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                            {user?.name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{user?.name || t('nav.user')}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                          </div>
                        </div>
                      </div>

                      {/* Logout */}
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/10"
                      >
                        <LogOut className="h-[18px] w-[18px]" />
                        {t('nav.logout')}
                      </button>
                    </>
                  )}

                  {/* ── Admin Mobile Nav ── */}
                  {isAdmin && (
                    <>
                      {/* Brand Header */}
                      <MobileBrandHeader sub="ADMIN PANEL" />

                      {/* Nav Items */}
                      {adminNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = adminPanel === item.panel;
                        return (
                          <button
                            key={item.label}
                            onClick={() => { setAdminPanel(item.panel as AdminPanel); setOpen(false); }}
                            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                              isActive
                                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                            {item.label}
                          </button>
                        );
                      })}

                      {/* Admin User Info */}
                      <div className="my-2 border-t border-border/50 pt-3">
                        <div className="flex items-center gap-3 rounded-xl px-4 py-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                            {user?.name?.charAt(0) || 'A'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{user?.name || t('nav.adminLabel')}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                          </div>
                        </div>
                      </div>

                      {/* Exit Admin */}
                      <button
                        onClick={() => { setView('dashboard'); setOpen(false); }}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                      >
                        <LogOut className="h-[18px] w-[18px]" />
                        {t('nav.exitAdmin')}
                      </button>
                    </>
                  )}

                  {/* ── Landing Mobile Nav ── */}
                  {!isSidebarView && (
                    <>
                      <MobileBrandHeader />

                      <a href="/security" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-security'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <Sparkles className="h-[18px] w-[18px] shrink-0" /> {t('nav.features')}
                      </a>
                      <a href="/fees" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-fees'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <Calculator className="h-[18px] w-[18px] shrink-0" /> {t('nav.feeStructure')}
                      </a>
                      <a href="/how-it-works" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-how-it-works'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <ListChecks className="h-[18px] w-[18px] shrink-0" /> {t('nav.howItWorks')}
                      </a>
                      <a href="/marketplace" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-marketplace'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <Store className="h-[18px] w-[18px] shrink-0" /> {t('nav.marketplace')}
                      </a>
                      <a href="/faq" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-faq'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <CircleHelp className="h-[18px] w-[18px] shrink-0" /> {t('nav.faq')}
                      </a>
                      <a href="/blog" onClick={(e) => { e.preventDefault(); setOpen(false); setView('blog'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <BookOpen className="h-[18px] w-[18px] shrink-0" /> {t('nav.blog')}
                      </a>
                      <a href="/about" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-about'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <Users className="h-[18px] w-[18px] shrink-0" /> {t('nav.about')}
                      </a>
                      <a href="/contact" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-contact'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        <Mail className="h-[18px] w-[18px] shrink-0" /> {t('nav.contact')}
                      </a>
                      <div className="mt-4 border-t border-border pt-4">
                        {user ? (
                          <>
                            <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 mb-2">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                                {user?.name?.charAt(0) || 'U'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{user?.name || t('nav.user')}</p>
                                <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                              </div>
                            </div>
                            <Button onClick={() => {
                              setOpen(false); navigateToDashboard();
                            }} className="w-full gap-2 rounded-lg font-medium">
                              <LayoutDashboard className="h-4 w-4" /> {t('hero.startNow')}
                            </Button>
                            <button
                              onClick={() => { setOpen(false); handleLogout(); }}
                              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-destructive transition-all hover:bg-destructive/10"
                            >
                              <LogOut className="h-4 w-4" /> {t('nav.logout')}
                            </button>
                          </>
                        ) : (
                          <Button onClick={() => {
                            setOpen(false); setView('auth');
                          }} className="w-full gap-2 rounded-lg font-medium">
                            <LogIn className="h-4 w-4" /> {t('nav.loginRegister')}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
            )}
          </div>
      </nav>
    </header>
  );
}