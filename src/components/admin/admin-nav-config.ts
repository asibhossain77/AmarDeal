import {
  LayoutDashboard,
  ShieldCheck,
  Handshake,
  Users,
  Settings,
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
  ShieldAlert,
  Bot,
} from 'lucide-react';
import type { AdminPanel } from '@/lib/store';

export interface NavItem {
  label: string;
  icon: React.ElementType;
  panel: AdminPanel;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: 'পরিচালনা',
    items: [
      { label: 'ড্যাশবোর্ড', icon: LayoutDashboard, panel: 'dashboard' },
      { label: 'পেমেন্ট ভেরিফিকেশন', icon: ShieldCheck, panel: 'payment-verify' },
      { label: 'পেআউট ম্যানেজমেন্ট', icon: Banknote, panel: 'payouts' },
      { label: 'লাইভ চ্যাট', icon: Headphones, panel: 'admin-calls' },
      { label: 'বিরোধ ম্যানেজমেন্ট', icon: AlertTriangle, panel: 'disputes' },
    ],
  },
  {
    title: 'ডিল ও ইউজার',
    items: [
      { label: 'সকল ডিল', icon: Handshake, panel: 'all-deals' },
      { label: 'ইউজার ম্যানেজমেন্ট', icon: Users, panel: 'users' },
    ],
  },
  {
    title: 'অর্থ ও ফি',
    items: [
      { label: 'পেমেন্ট মেথড', icon: CreditCard, panel: 'payment-methods' },
      { label: 'ফি কাঠামো', icon: Receipt, panel: 'fee-rules' },
    ],
  },
  {
    title: 'সেটিংস ও কন্টেন্ট',
    items: [
      { label: 'ওয়েবসাইট সেটিংস', icon: Settings, panel: 'settings' },
      { label: 'ইমেইল সেটিংস', icon: Mail, panel: 'email-settings' },
      { label: 'AI সাপোর্ট', icon: Bot, panel: 'ai-prompt' },
      { label: 'চুক্তি পেজ', icon: FileText, panel: 'contract' },
      { label: 'ব্লগ', icon: BookOpen, panel: 'blog' },
      { label: 'যোগাযোগ', icon: MessageCircle, panel: 'contact-info' },
    ],
  },
  {
    title: 'অ্যাকাউন্ট',
    items: [
      { label: 'প্রোফাইল', icon: UserCircle, panel: 'profile' },
      { label: 'টু-ফ্যাক্টর অথেনটিকেশন', icon: ShieldAlert, panel: 'two-factor' },
    ],
  },
];

/** Flat list — for backwards compat / lookups */
export const ALL_NAV_ITEMS: NavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

/** Panels always accessible to any admin/staff/support */
export const ALWAYS_ALLOWED = new Set<string>(['dashboard', 'profile', 'two-factor']);

/** Support admin: predefined permissions — no sensitive settings */
export const SUPPORT_ALLOWED = new Set<string>([
  'dashboard',
  'profile',
  'two-factor',
  'payment-verify',
  'payouts',
  'admin-calls',
  'disputes',
  'all-deals',
  'contact-info',
  'blog',
  'email-settings',
]);

/** Filter groups by role/permissions — removes empty groups */
export function filterNavGroups(
  role: string | null | undefined,
  permissions: string[],
): NavGroup[] {
  const allowed = (panel: string) =>
    !role || role === 'super_admin'
      ? true
      : role === 'support'
        ? SUPPORT_ALLOWED.has(panel)
        : role === 'staff'
          ? ALWAYS_ALLOWED.has(panel) || permissions.includes(panel)
          : true;

  return ADMIN_NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.panel)) }))
    .filter((g) => g.items.length > 0);
}