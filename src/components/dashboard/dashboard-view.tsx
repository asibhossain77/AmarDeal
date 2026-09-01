'use client';

import { useState, useSyncExternalStore } from 'react';
import { DashboardSidebar, navItems, sellerNavItems } from './dashboard-sidebar';
import { DashboardMain } from './dashboard-main';
import { useAppStore, type DashboardPanel } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useTheme } from 'next-themes';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Menu, Sun, Moon, Globe, Home, ShoppingCart } from 'lucide-react';
import { SellerApplyButton } from './seller-apply-dialog';

const emptySubscribe = () => () => {};

function getPanelLabel(panel: DashboardPanel, t: (key: string) => string): string {
  const all = [...navItems, ...sellerNavItems];
  return all.find((n) => n.panel === panel)?.labelKey ? t(all.find((n) => n.panel === panel)!.labelKey as any) : '';
}

export function DashboardView() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dashboardPanel, setDashboardPanel, user, logout, locale, setLocale, setView } = useAppStore();
  const t = useT();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const isSeller = user?.isSeller && !user?.sellerDisabled;

  const handleNavClick = (panel: DashboardPanel) => {
    if (panel === 'my-deals') {
      useAppStore.getState().setActiveDeal(null);
    }
    setDashboardPanel(panel);
    setMobileOpen(false);
  };

  const toggleLocale = () => setLocale(locale === 'bn' ? 'en' : 'bn');

  return (
    <div className="min-h-screen">
      {/* Fixed Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-2.5">
            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors md:hidden"
                  aria-label={t('nav.openMenu')}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0">
                <SheetHeader className="p-4 pb-3 border-b border-border/50">
                  <SheetTitle className="text-base font-bold">{t('nav.dashboard')}</SheetTitle>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto p-3" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                  {/* Regular nav items */}
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = dashboardPanel === item.panel;
                    return (
                      <button
                        key={item.labelKey}
                        onClick={() => handleNavClick(item.panel)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          active
                            ? 'bg-primary/10 text-primary dark:bg-primary/15'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {t(item.labelKey as any)}
                      </button>
                    );
                  })}

                  {/* Seller section */}
                  {isSeller && (
                    <>
                      <div className="flex items-center gap-2 px-3 pt-5 pb-2">
                        <div className="h-px flex-1 bg-border/50" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/60">{t('nav.sellerMode') || 'সেলার'}</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      {sellerNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = dashboardPanel === item.panel;
                        return (
                          <button
                            key={item.panel}
                            onClick={() => handleNavClick(item.panel)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                              active
                                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px] shrink-0" />
                            {t(item.labelKey as any)}
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Marketplace */}
                  <button
                    onClick={() => { setView('page-marketplace'); setMobileOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                  >
                    <ShoppingCart className="h-[18px] w-[18px] shrink-0" />
                    {t('page.marketplace.title') || 'মার্কেটপ্লেস'}
                  </button>
                </nav>
                <div className="border-t border-border/50 p-3 space-y-2">
                  {!isSeller && !user?.isAdmin && (
                    <div className="px-1">
                      <SellerApplyButton variant="sidebar" />
                    </div>
                  )}
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-[18px] w-[18px] shrink-0" />
                    {t('nav.logout')}
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Dashboard label - show on all screens */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-primary/15 hidden md:flex items-center justify-center">
                <span className="text-xs font-bold text-primary">M</span>
              </div>
              <h1 className="text-sm font-bold tracking-tight text-foreground">{t('nav.dashboard')}</h1>
              {/* Mobile: current panel label */}
              <span className="text-sm font-medium text-muted-foreground truncate md:hidden">
                {getPanelLabel(dashboardPanel, t)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">

            <button
              onClick={toggleLocale}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Toggle language"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{locale === 'bn' ? 'BN' : 'EN'}</span>
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            <button
              onClick={() => setView('landing')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Home"
            >
              <Home className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="flex pt-14">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 md:pl-64 overflow-x-hidden">
          <DashboardMain />
        </div>
      </div>
    </div>
  );
}