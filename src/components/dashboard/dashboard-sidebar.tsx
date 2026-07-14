'use client';

import { useSyncExternalStore } from 'react';
import { useAppStore, type DashboardPanel } from '@/lib/store';
import {
  LayoutDashboard,
  Handshake,
  ArrowLeftRight,
  UserCircle,
  LogOut,
  Settings,
} from 'lucide-react';

const emptySubscribe = () => () => {};

interface NavItem {
  label: string;
  icon: React.ElementType;
  panel: DashboardPanel;
}

const navItems: NavItem[] = [
  { label: 'ড্যাশবোর্ড', icon: LayoutDashboard, panel: 'overview' },
  { label: 'আমার ডিল', icon: Handshake, panel: 'my-deals' },
  { label: 'লেনদেন', icon: ArrowLeftRight, panel: 'payment' },
  { label: 'প্রোফাইল', icon: UserCircle, panel: 'profile' },
  { label: 'সেটিংস', icon: Settings, panel: 'settings' },
];

export function DashboardSidebar() {
  const { logout, dashboardPanel, setDashboardPanel } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const user = useAppStore((s) => s.user);

  if (!mounted) return null;

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:top-16 border-r border-border/50 bg-white dark:bg-zinc-900 z-40">
      <div className="flex h-full flex-col">
        {/* Navigation — pl-5 aligns with header logo area */}
        <nav className="flex-1 space-y-1 pl-5 pr-3 pt-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = dashboardPanel === item.panel;
            return (
              <button
                key={item.label}
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
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Info + Logout at bottom — pl-5 aligns with header logo area */}
        <div className="border-t border-border/50 pl-5 pr-3 pt-4 pb-4">
          <div className="flex items-center gap-3 rounded-xl py-2 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {user?.name?.charAt(0) || 'ই'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user?.name || 'ইউজার'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px]" />
            লগআউট
          </button>
        </div>
      </div>
    </aside>
  );
}