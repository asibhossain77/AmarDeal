'use client';

import { useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { LogOut } from 'lucide-react';
import { getAdminNavGroups, filterTranslatedNavGroups } from './admin-nav-config';

const emptySubscribe = () => () => {};

export function AdminSidebar() {
  const { logout, adminPanel, setAdminPanel, user } = useAppStore();
  const t = useT();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const groups = filterTranslatedNavGroups(
    getAdminNavGroups(t),
    user?.adminRole,
    user?.permissions ?? [],
  );

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:top-0 border-r border-border/50 bg-white dark:bg-zinc-900 z-40">
      <div className="flex h-full flex-col">
        <nav className="flex-1 overflow-y-auto pl-5 pr-3 pt-6">
          {groups.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = adminPanel === item.panel;
                  return (
                    <button
                      key={item.panel}
                      onClick={() => setAdminPanel(item.panel)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? 'bg-primary/10 text-primary dark:bg-primary/15'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Admin User Info + Logout */}
        <div className="border-t border-border/50 pl-5 pr-3 pt-4 pb-4">
          <div className="flex items-center gap-3 rounded-xl py-2 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.name || t('nav.adminLabel')}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.adminRole === 'staff' ? 'Staff' : user?.adminRole === 'super_admin' ? t('profile.roleSuperAdmin') : 'Support'}
              </p>
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