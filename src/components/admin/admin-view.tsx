'use client';

import { useState, useSyncExternalStore } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminMain } from './admin-main';
import { useAppStore, type AdminPanel } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Menu } from 'lucide-react';
import { filterNavGroups, ALL_NAV_ITEMS } from './admin-nav-config';

const emptySubscribe = () => () => {};

function getPanelLabel(panel: AdminPanel): string {
  return ALL_NAV_ITEMS.find((n) => n.panel === panel)?.label || '';
}

export function AdminView() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { adminPanel, setAdminPanel, user, logout } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const groups = filterNavGroups(user?.adminRole, user?.permissions ?? []);

  const handleNavClick = (panel: AdminPanel) => {
    setAdminPanel(panel);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar */}
      <AdminSidebar />

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-30 bg-white dark:bg-zinc-900 border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-12">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                aria-label="মেনু খুলুন"
              >
                <Menu className="h-5 w-5" />
                <span className="truncate max-w-[200px]">{getPanelLabel(adminPanel)}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="p-4 pb-2 border-b border-border/50">
                <SheetTitle className="text-base">অ্যাডমিন মেনু</SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto p-3" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                {groups.map((group) => (
                  <div key={group.title} className="mb-4 last:mb-0">
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
                  </div>
                ))}
              </nav>
              <div className="border-t border-border/50 p-3">
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  লগআউট
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
              {user?.name?.charAt(0) || 'অ'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 pt-12 lg:pt-0">
        <AdminMain />
      </div>
    </div>
  );
}