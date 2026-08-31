'use client';

import { useState, useSyncExternalStore } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminMain } from './admin-main';
import { useAppStore, type AdminPanel } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useTheme } from 'next-themes';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LogOut, Menu, Sun, Moon, Globe, Home, ChevronDown } from 'lucide-react';
import { getAdminNavGroups, filterTranslatedNavGroups, ALL_NAV_ITEMS } from './admin-nav-config';
import { AnimatePresence, motion } from 'framer-motion';

const emptySubscribe = () => () => {};

function getPanelLabel(panel: AdminPanel, t: (key: string) => string): string {
  const translated = getAdminNavGroups(t).flatMap((g) => g.items);
  return translated.find((n) => n.panel === panel)?.label || ALL_NAV_ITEMS.find((n) => n.panel === panel)?.label || '';
}

export function AdminView() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { adminPanel, setAdminPanel, user, logout, locale, setLocale, setView } = useAppStore();
  const t = useT();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const groups = filterTranslatedNavGroups(
    getAdminNavGroups(t),
    user?.adminRole,
    user?.permissions ?? [],
  );

  const handleNavClick = (panel: AdminPanel) => {
    setAdminPanel(panel);
    setMobileOpen(false);
  };

  const toggleLocale = () => setLocale(locale === 'bn' ? 'en' : 'bn');

  return (
    <div className="min-h-screen">
      {/* Fixed Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-2.5">
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
                  <SheetTitle className="text-base font-bold">{t('nav.adminLabel')}</SheetTitle>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto p-3" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                  {groups.map((group) => {
                    const hasActive = group.items.some((item) => adminPanel === item.panel);
                    return (
                      <Collapsible key={group.title} defaultOpen={hasActive} className="mb-3 last:mb-0">
                        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground hover:bg-accent/50 transition-colors">
                          <span>{group.title}</span>
                          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-1 space-y-0.5">
                            {group.items.map((item) => {
                              const Icon = item.icon;
                              const active = adminPanel === item.panel;
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
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </nav>
                <div className="border-t border-border/50 p-3">
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

            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">A</span>
              </div>
              <h1 className="text-sm font-bold tracking-tight text-foreground">Admin</h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile: current panel label */}
            <span className="text-sm font-medium text-muted-foreground truncate max-w-[140px] sm:max-w-[200px] md:hidden">
              {getPanelLabel(adminPanel, t)}
            </span>

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
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            <button
              onClick={() => setView('landing')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Home"
            >
              <Home className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="flex pt-14">
        {/* Desktop Sidebar — fully hidden on mobile */}
        <div className="hidden md:block">
          <AdminSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 md:pl-64">
          <AdminMain />
        </div>
      </div>
    </div>
  );
}
