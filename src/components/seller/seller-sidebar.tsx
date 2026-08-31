'use client';

import { useState, useSyncExternalStore, useEffect } from 'react';
import { useAppStore, type SellerPanel } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useT } from '@/lib/i18n';
import {
  LayoutDashboard,
  Clock,
  Package,
  LogOut,
  X,
  UserCircle,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cdnUrl } from '@/lib/cdn-url';

const emptySubscribe = () => () => {};

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  panel: SellerPanel;
}

const navItemKeys: { labelKey: string; icon: React.ElementType; panel: SellerPanel }[] = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, panel: 'overview' },
  { labelKey: 'status.active', icon: Clock, panel: 'active-deals' },
  { labelKey: 'seller.myProducts', icon: Package, panel: 'my-products' },
  { labelKey: 'seller.addProduct', icon: Plus, panel: 'add-product' },
  { labelKey: 'seller.businessProfile', icon: UserCircle, panel: 'business-profile' },
];

export function SellerSidebar() {
  const { sidebarOpen, setSidebarOpen, logout, setSellerPanel } = useAppStore();
  const sellerPanel = useAppStore((s) => s.sellerPanel);
  const user = useAppStore((s) => s.user);
  const sidebarAvatarUrl = cdnUrl(user?.imageLink);
  const [sidebarAvatarLoaded, setSidebarAvatarLoaded] = useState(false);
  useEffect(() => { setSidebarAvatarLoaded(false); if (!sidebarAvatarUrl) return; const img = new Image(); img.onload = () => setSidebarAvatarLoaded(true); img.src = sidebarAvatarUrl; }, [sidebarAvatarUrl]);
  const { siteName, siteLogo } = useSiteSettings();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

  if (!mounted) return null;

  const handleLogout = () => {
    logout();
    setSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 pb-6">
        <div className="flex items-center gap-2.5">
          {siteLogo ? (
            <img
              src={cdnUrl(siteLogo) || ''}
              alt={siteName}
              className="h-9 w-9 rounded-lg object-contain"
              loading="lazy" decoding="async"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-sm font-bold text-primary">{siteName?.charAt(0) || 'M'}</span>
            </div>
          )}
          <span className="text-lg font-bold tracking-tight text-foreground">{siteName}</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors md:hidden"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItemKeys.map((item) => {
          const Icon = item.icon;
          const isActive = sellerPanel === item.panel;
          return (
            <button
              key={item.labelKey}
              onClick={() => {
                setSellerPanel(item.panel);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
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

      {/* User Info + Logout at bottom */}
      <div className="border-t border-border/50 p-4">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2 mb-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary overflow-hidden"
            style={sidebarAvatarUrl && sidebarAvatarLoaded
              ? { backgroundImage: `url(${sidebarAvatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { backgroundColor: 'oklch(0.768 0.189 131 / 0.15)' }
            }
          >
            {!(sidebarAvatarUrl && sidebarAvatarLoaded) && (user?.name?.charAt(0) || t('seller.welcomeSeller').charAt(0))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name || t('profile.roleSeller')}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:top-16 border-r border-border/50 bg-white dark:bg-zinc-900 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border/50 bg-white dark:bg-zinc-900 md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}