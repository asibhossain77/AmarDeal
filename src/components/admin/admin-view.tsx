'use client';

import { useState, useSyncExternalStore } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminMain } from './admin-main';
import { useAppStore, type AdminPanel } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  ShieldCheck,
  Handshake,
  Users,
  Settings,
  LogOut,
  CreditCard,
  Receipt,
  MessageCircle,
  UserCircle,
  FileText,
  Banknote,
  Headphones,
  AlertTriangle,
  BookOpen,
  Mail,
  Menu,
} from 'lucide-react';

const emptySubscribe = () => () => {};

interface NavItem {
  label: string;
  icon: React.ElementType;
  panel: AdminPanel;
}

const navItems: NavItem[] = [
  { label: 'ড্যাশবোর্ড', icon: LayoutDashboard, panel: 'dashboard' },
  { label: 'পেমেন্ট ভেরিফিকেশন', icon: ShieldCheck, panel: 'payment-verify' },
  { label: 'পেআউট ম্যানেজমেন্ট', icon: Banknote, panel: 'payouts' },
  { label: 'লাইভ চ্যাট', icon: Headphones, panel: 'admin-calls' },
  { label: 'বিরোধ ম্যানেজমেন্ট', icon: AlertTriangle, panel: 'disputes' },
  { label: 'পেমেন্ট মেথড', icon: CreditCard, panel: 'payment-methods' },
  { label: 'ফি কাঠামো', icon: Receipt, panel: 'fee-rules' },
  { label: 'সকল ডিল', icon: Handshake, panel: 'all-deals' },
  { label: 'ইউজার ম্যানেজমেন্ট', icon: Users, panel: 'users' },
  { label: 'যোগাযোগ', icon: MessageCircle, panel: 'contact-info' },
  { label: 'ওয়েবসাইট সেটিংস', icon: Settings, panel: 'settings' },
  { label: 'চুক্তি পেজ', icon: FileText, panel: 'contract' },
  { label: 'ব্লগ', icon: BookOpen, panel: 'blog' },
  { label: 'ইমেইল সেটিংস', icon: Mail, panel: 'email-settings' },
  { label: 'প্রোফাইল', icon: UserCircle, panel: 'profile' },
];

const ALWAYS_ALLOWED = new Set<string>(['dashboard', 'profile']);
const SUPPORT_ALLOWED = new Set<string>([
  'dashboard',
  'profile',
  'payment-verify',
  'payouts',
  'admin-calls',
  'disputes',
  'all-deals',
  'contact-info',
  'blog',
  'email-settings',
]);

function getPanelLabel(panel: AdminPanel): string {
  return navItems.find((n) => n.panel === panel)?.label || '';
}

export function AdminView() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { adminPanel, setAdminPanel, user, logout } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const role = user?.adminRole;
  const permissions = user?.permissions ?? [];

  // Permission filter (same logic as sidebar)
  let filteredNav = navItems;
  if (role === 'staff') {
    filteredNav = navItems.filter((item) => ALWAYS_ALLOWED.has(item.panel) || permissions.includes(item.panel));
  } else if (role === 'support') {
    filteredNav = navItems.filter((item) => SUPPORT_ALLOWED.has(item.panel));
  }

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
              <nav className="flex-1 overflow-y-auto p-3 space-y-1" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  const active = adminPanel === item.panel;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleNavClick(item.panel)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
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