'use client';

import { useSyncExternalStore } from 'react';
import { useAppStore, type AdminPanel } from '@/lib/store';
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

/** Panels always accessible to any admin/staff/support */
const ALWAYS_ALLOWED = new Set<string>(['dashboard', 'profile']);

/** Support admin: predefined permissions — no sensitive settings */
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
]);

export function AdminSidebar() {
  const { logout, adminPanel, setAdminPanel, user } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const role = user?.adminRole;
  const permissions = user?.permissions ?? [];

  let filteredNav = navItems;
  if (role === 'staff') {
    filteredNav = navItems.filter((item) => ALWAYS_ALLOWED.has(item.panel) || permissions.includes(item.panel));
  } else if (role === 'support') {
    filteredNav = navItems.filter((item) => SUPPORT_ALLOWED.has(item.panel));
  }

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:top-16 border-r border-border/50 bg-white dark:bg-zinc-900 z-40">
      <div className="flex h-full flex-col">
        {/* Navigation — pl-5 aligns with header logo area */}
        <nav className="flex-1 space-y-1 pl-5 pr-3 pt-6">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const active = adminPanel === item.panel;
            return (
              <button
                key={item.label}
                onClick={() => setAdminPanel(item.panel)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
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
        </nav>

        {/* Admin User Info + Logout — pl-5 aligns with header logo area */}
        <div className="border-t border-border/50 pl-5 pr-3 pt-4 pb-4">
          <div className="flex items-center gap-3 rounded-xl py-2 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {user?.name?.charAt(0) || 'অ'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.name || 'অ্যাডমিন'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.adminRole === 'staff' ? 'স্টাফ' : user?.adminRole === 'super_admin' ? 'সুপার অ্যাডমিন' : 'সাপোর্ট'}
              </p>
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