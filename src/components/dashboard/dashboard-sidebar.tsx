'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { useAppStore, type DashboardPanel } from '@/lib/store';
import {
  LayoutDashboard,
  Handshake,
  ArrowLeftRight,
  UserCircle,
  LogOut,
  Settings,
  Users,
  MessageSquare,
  Store,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { SellerApplyButton } from './seller-apply-dialog';
import { cdnUrl } from '@/lib/cdn-url';

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
  { labelKey: 'nav.review', icon: MessageSquare, panel: 'review' },
  { labelKey: 'nav.settings', icon: Settings, panel: 'settings' },
];

export function DashboardSidebar() {
  const { logout, dashboardPanel, setDashboardPanel } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const user = useAppStore((s) => s.user);
  const t = useT();
  const [imgLoaded, setImgLoaded] = useState(false);

  const currentImage = user?.imageLink || null;

  // Preload image
  useEffect(() => {
    setImgLoaded(false);
    if (!currentImage) return;
    const img = new Image();
    img.onload = () => setImgLoaded(true);
    img.onerror = () => setImgLoaded(false);
    img.src = cdnUrl(currentImage) || '';
  }, [currentImage]);

  if (!mounted) return null;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:top-16 border-r border-border/50 bg-white dark:bg-zinc-900 z-40">
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 pl-5 pr-3 pt-6">
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

        <div className="border-t border-border/50 pl-5 pr-3 pt-4 pb-4 space-y-3">
          {!user?.isAdmin && (
            <SellerApplyButton variant="sidebar" />
          )}
          <div className="flex items-center gap-3 rounded-xl py-2">
            <div
              className="h-9 w-9 shrink-0 rounded-full overflow-hidden"
              style={currentImage && imgLoaded
                ? { backgroundImage: `url(${cdnUrl(currentImage) || ''})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { backgroundColor: 'oklch(0.768 0.189 131 / 0.15)' }
              }
            >
              {!(currentImage && imgLoaded) && (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold select-none"
                  style={{ color: 'oklch(0.768 0.189 131)' }}
                >
                  {user?.name?.charAt(0) || 'U'}
                </span>
              )}
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
      </div>
    </aside>
  );
}
