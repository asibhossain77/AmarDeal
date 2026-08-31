'use client';

import { useSyncExternalStore } from 'react';
import { SellerSidebar } from './seller-sidebar';
import { SellerMain } from './seller-main';
import { useAppStore } from '@/lib/store';
import { useTheme } from 'next-themes';
import { Menu, Sun, Moon, Globe, Home } from 'lucide-react';

const emptySubscribe = () => () => {};

export function SellerView() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, setSidebarOpen, setView } = useAppStore();

  if (!mounted) return null;

  const toggleLocale = () => setLocale(locale === 'bn' ? 'en' : 'bn');

  return (
    <div className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors md:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">S</span>
              </div>
              <h1 className="text-sm font-bold tracking-tight text-foreground">Seller</h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
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

      <div className="flex pt-14">
        <SellerSidebar />
        <div className="flex-1 md:pl-64">
          <SellerMain />
        </div>
      </div>
    </div>
  );
}
