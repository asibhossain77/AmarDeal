'use client';

import { useState, useSyncExternalStore } from 'react';
import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardMain } from './dashboard-main';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Handshake,
  ArrowLeftRight,
  UserCircle,
  Users,
  Settings,
  Menu,
  LogOut,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useAppStore, type DashboardPanel } from '@/lib/store';

const emptySubscribe = () => () => {};

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  panel: DashboardPanel;
}

const navItems: NavItem[] = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, panel: 'overview' },
  { labelKey: 'nav.myDeals', icon: Handshake, panel: 'my-deals' },
  { labelKey: 'nav.transactions', icon: ArrowLeftRight, panel: 'payment' },
  { labelKey: 'nav.profile', icon: UserCircle, panel: 'profile' },
  { labelKey: 'nav.affiliate', icon: Users, panel: 'affiliate' },
  { labelKey: 'nav.settings', icon: Settings, panel: 'settings' },
];

export function DashboardView() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dashboardPanel, setDashboardPanel, logout, user } = useAppStore();
  const t = useT();

  if (!mounted) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] min-w-0">
      {/* Desktop Sidebar */}
      <DashboardSidebar />

      {/* Mobile Top Nav */}
      <div className="md:hidden fixed top-16 left-0 right-0 z-30 bg-white dark:bg-zinc-900 border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors">
                <Menu className="h-5 w-5" />
                <span className="font-semibold">
                  {t(navItems.find((n) => n.panel === dashboardPanel)?.labelKey as any) || t('nav.dashboard')}
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="p-4 pb-2 border-b border-border/50">
                <SheetTitle className="text-base">{t('nav.dashboardLabel') || 'ড্যাশবোর্ড'}</SheetTitle>
              </SheetHeader>
              <nav className="flex-1 space-y-1 p-3 pt-2 overflow-y-auto max-h-[calc(100vh-10rem)]">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = dashboardPanel === item.panel;
                  return (
                    <button
                      key={item.labelKey}
                      onClick={() => {
                        if (item.panel === 'my-deals') {
                          useAppStore.getState().setActiveDeal(null);
                        }
                        setDashboardPanel(item.panel);
                        setMobileOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary dark:bg-primary/15'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {t(item.labelKey as any)}
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-border/50 p-3 pt-4">
                <div className="flex items-center gap-3 rounded-xl py-2 mb-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{user?.name || t('dashboard.user')}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                  {t('nav.logout')}
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <span className="text-xs font-semibold text-muted-foreground">
            {t(navItems.find((n) => n.panel === dashboardPanel)?.labelKey as any) || ''}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 md:pl-64 overflow-x-hidden pt-10 md:pt-0">
        <DashboardMain />
      </div>
    </div>
  );
}
