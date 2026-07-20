'use client';

import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAppStore, type AdminPanel } from '@/lib/store';
import { invalidateSiteSettingsCache, useSiteSettings } from '@/lib/use-site-settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const PaymentMethodsPanel = dynamic(() => import('./payment-methods-panel').then(m => ({ default: m.PaymentMethodsPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const FeeRulesPanel = dynamic(() => import('./fee-rules-panel').then(m => ({ default: m.FeeRulesPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const ContactInfoPanel = dynamic(() => import('./contact-info-panel').then(m => ({ default: m.ContactInfoPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const AdminProfilePanel = dynamic(() => import('./admin-profile-panel').then(m => ({ default: m.AdminProfilePanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const ContractPanel = dynamic(() => import('./contract-panel').then(m => ({ default: m.ContractPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const BlogPanel = dynamic(() => import('./blog-panel').then(m => ({ default: m.BlogPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const EmailSettingsPanel = dynamic(() => import('./email-settings-panel').then(m => ({ default: m.EmailSettingsPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const TwoFactorPanel = dynamic(() => import('./two-factor-panel').then(m => ({ default: m.TwoFactorPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
const AiPromptPanel = dynamic(() => import('./ai-prompt-panel').then(m => ({ default: m.AiPromptPanel })), { loading: () => <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">লোড হচ্ছে...</span></div> });
import {
  Bell,
  ShieldCheck,
  ShieldX,
  Handshake,
  Wallet,
  Users,
  Settings,
  CheckCircle,
  Loader2,
  Search,
  ChevronDown,
  XCircle,
  AlertTriangle,
  Save,
  ArrowLeft,
  Pencil,
  Clock,
  Copy,
  Hash,
  UserX,
  UserCheck,
  KeyRound,
  Eye,
  Mail,
  Phone,
  Banknote,
  CreditCard,
  Upload,
  Headphones,
  SendHorizonal,
  ArrowRight,
  MessageCircle,
  FileText,
  TrendingUp,
  Shield,
  UserCog,
  User,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

const emptySubscribe = () => () => {};

/* ─── Admin Chat Message Styles ─── */
function AdminChatBubble({ msg }: { msg: AdminChatMsg }) {
  const isAdmin = msg.role === 'admin';
  const isSystem = msg.role === 'system';
  const isBuyer = msg.role === 'buyer';
  const isSeller = msg.role === 'seller';

  const align = isAdmin || isSystem ? 'justify-center' : isBuyer ? 'justify-start' : 'justify-end';

  const bubbleStyle = isSystem
    ? 'bg-amber-50 dark:bg-amber-500/8 text-amber-800 dark:text-amber-200 border border-amber-200/60 dark:border-amber-500/20'
    : isAdmin
    ? 'bg-purple-50 dark:bg-purple-500/8 text-purple-900 dark:text-purple-200 border border-purple-200/60 dark:border-purple-500/20'
    : isBuyer
    ? 'bg-sky-50 dark:bg-sky-500/8 text-sky-900 dark:text-sky-200 border border-sky-200/60 dark:border-sky-500/20'
    : 'bg-emerald-50 dark:bg-emerald-500/8 text-emerald-900 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-500/20';

  const labelStyle = isSystem
    ? 'text-[10px] font-bold text-amber-600 dark:text-amber-400'
    : isAdmin
    ? 'text-[10px] font-bold text-purple-600 dark:text-purple-400'
    : isBuyer
    ? 'text-[10px] font-bold text-sky-600 dark:text-sky-400'
    : 'text-[10px] font-bold text-emerald-600 dark:text-emerald-400';

  const label = isSystem ? 'System' : isAdmin ? `${msg.senderName} (Admin)` : msg.senderName || 'Unknown';
  const showLabel = isSystem || isAdmin || isBuyer || isSeller;

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${bubbleStyle}`}>
        {showLabel && <p className={`${labelStyle} mb-0.5`}>{label}</p>}
        <p className="leading-relaxed">{msg.text}</p>
      </div>
    </div>
  );
}

/* ─── Types ─── */
interface DealRow {
  id: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
  senderNumber?: string | null;
  transactionId?: string | null;
  paymentAmount?: number | null;
  platformFee?: number | null;
  paymentMethodId?: string | null;
  buyer?: { name: string; email: string } | null;
  seller?: { name: string; email: string } | null;
  creator?: { name: string; email: string } | null;
  paymentMethod?: {
    id: string;
    name: string;
    accountNumber: string;
    accountType: string;
    image: string | null;
    color: string;
  } | null;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  isAdmin: boolean;
  adminRole: string | null;
  adminPermissions: string[];
  createdAt: string;
}

interface AdminStats {
  totalDeals: number;
  totalUsers: number;
  pendingVerification: number;
  pendingPayouts: number;
  completedAmount: number;
  totalProfit: number;
  adminCalls: number;
  disputedCount: number;
}

interface PlatformSettings {
  platform_name: string;
  site_logo: string;
  fee_percentage: string;
  min_deal_amount: string;
  max_deal_amount: string;
  support_number: string;
  footer_description: string;
  footer_copyright_text: string;
  footer_made_in: string;
}

/* ─── Solid Card Helper ─── */
function SolidCard({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl bg-white p-3.5 sm:p-5 shadow-lg dark:bg-zinc-900 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Status Badge Helper ─── */
function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const config: Record<string, { label: string; classes: string }> = {
    created: {
      label: t('status.created'),
      classes:
        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    },
    pending: {
      label: t('status.pending'),
      classes:
        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    },
    payment_pending: {
      label: t('status.paymentPending'),
      classes:
        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    },
    payment_verified: {
      label: t('status.verified'),
      classes:
        'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    },
    in_delivery: {
      label: t('status.inDelivery'),
      classes:
        'bg-primary/15 text-primary dark:bg-primary/20',
    },
    delivery_confirmed: {
      label: t('status.inDelivery'),
      classes:
        'bg-primary/15 text-primary dark:bg-primary/20',
    },
    completed: {
      label: t('status.completed'),
      classes:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    },
    rejected: {
      label: t('status.rejected'),
      classes:
        'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    },
    cancelled: {
      label: t('status.cancelled'),
      classes:
        'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    },
  };
  const c =
    config[status] || {
      label: status,
      classes:
        'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400',
    };
  return (
    <Badge className={`${c.classes} border-0 font-medium`}>{c.label}</Badge>
  );
}

/* ─── Role Badge Helper ─── */
function RoleBadge({ isAdmin, adminRole, adminPermissions }: { isAdmin: boolean; adminRole: string | null; adminPermissions?: string[] }) {
  const t = useT();
  if (isAdmin) {
    let label = 'Support';
    let colorClass = 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0';
    if (adminRole === 'super_admin') {
      label = t('profile.roleSuperAdmin');
      colorClass = 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0';
    } else if (adminRole === 'staff') {
      label = 'Staff';
      colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0';
      const count = (adminPermissions || []).length;
      if (count > 0) label += ` (${count})`;
    }
    return (
      <Badge className={`${colorClass} font-medium`}>
        {label}
      </Badge>
    );
  }
  return null;
}

/* ─── Admin Stat Card Skeleton ─── */
function AdminStatCardSkeleton() {
  return (
    <SolidCard>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 sm:w-24 animate-pulse rounded bg-muted" />
          <div className="h-6 sm:h-7 w-14 sm:w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-10 sm:h-11 sm:w-11 animate-pulse rounded-xl bg-muted" />
      </div>
    </SolidCard>
  );
}

/* ─── Loading Spinner ─── */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel 1: ড্যাশবোর্ড — 3 Stats Cards
   ═══════════════════════════════════════════ */

function DashboardStatsPanel() {
  const t = useT();
  const user = useAppStore((s) => s.user);
  const setAdminPanel = useAppStore((s) => s.setAdminPanel);
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const role = user?.adminRole;
  const staffPerms = new Set(user?.permissions ?? []);
  const ALWAYS = new Set(['dashboard', 'profile']);
  const SUPPORT_ALLOWED = new Set(['dashboard','profile','payment-verify','payouts','admin-calls','disputes','all-deals','contact-info','blog']);

  const canAccess = (target: string) => {
    if (role === 'super_admin') return true;
    if (role === 'support') return SUPPORT_ALLOWED.has(target);
    if (role === 'staff') return ALWAYS.has(target) || staffPerms.has(target);
    return true;
  };

  const allCards = stats
    ? [
        {
          label: t('adminNav.userManagement'),
          value: stats.totalUsers.toLocaleString('en'),
          icon: Users,
          color: 'text-violet-500 dark:text-violet-400',
          bg: 'bg-violet-500/10',
          target: 'users' as const,
        },
        {
          label: t('adminNav.allDeals'),
          value: stats.totalDeals.toLocaleString('en'),
          icon: Handshake,
          color: 'text-primary',
          bg: 'bg-primary/10',
          target: 'all-deals' as const,
        },
        {
          label: t('status.pendingVerification'),
          value: stats.pendingVerification.toLocaleString('en'),
          icon: ShieldCheck,
          color: 'text-amber-500 dark:text-amber-400',
          bg: 'bg-amber-500/10',
          target: 'payment-verify' as const,
        },
        {
          label: t('adminNav.payoutManagement'),
          value: stats.pendingPayouts.toLocaleString('en'),
          icon: Banknote,
          color: 'text-orange-500 dark:text-orange-400',
          bg: 'bg-orange-500/10',
          target: 'payouts' as const,
        },
        {
          label: t('adminNav.liveChat'),
          value: stats.adminCalls.toLocaleString('en'),
          icon: Headphones,
          color: 'text-red-500 dark:text-red-400',
          bg: 'bg-red-500/10',
          target: 'admin-calls' as const,
        },
        {
          label: t('adminNav.disputeManagement'),
          value: stats.disputedCount.toLocaleString('en'),
          icon: AlertTriangle,
          color: 'text-rose-500 dark:text-rose-400',
          bg: 'bg-rose-500/10',
          target: 'disputes' as const,
        },
        {
          label: 'Total Transactions (৳)',
          value: stats.completedAmount.toLocaleString('en'),
          icon: Wallet,
          color: 'text-emerald-500 dark:text-emerald-400',
          bg: 'bg-emerald-500/10',
          target: 'all-deals' as const,
        },
        {
          label: 'Total Profit (৳)',
          value: stats.totalProfit.toLocaleString('en'),
          icon: TrendingUp,
          color: 'text-teal-500 dark:text-teal-400',
          bg: 'bg-teal-500/10',
          target: 'all-deals' as const,
        },
      ]
    : [];

  // Filter cards based on role permissions
  const cards = role === 'super_admin' ? allCards : allCards.filter((c) => canAccess(c.target));

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <AdminStatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <SolidCard
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
              onClick={() => setAdminPanel(stat.target)}
            >
              <div className="flex items-center justify-between text-center sm:text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 sm:mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}
                >
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
              </div>
            </SolidCard>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel 2: পেমেন্ট ভেরিফিকেশন (Core)
   ═══════════════════════════════════════════ */

function PaymentVerifyPanel() {
  const t = useT();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'verify' | 'wrong_info' | 'cancel';
    deal: DealRow;
  } | null>(null);
  const [editedAmount, setEditedAmount] = useState('');
  const [isUpdatingAmount, setIsUpdatingAmount] = useState(false);

  // Initialize edited amount when a deal is selected
  useEffect(() => {
    if (selectedDeal) {
      setEditedAmount(String(selectedDeal.paymentAmount || selectedDeal.amount || ''));
    }
  }, [selectedDeal]);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deals');
      if (res.ok) {
        const data = await res.json();
        setDeals(data);
      }
    } catch {
      // use fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleVerify = async () => {
    if (!confirmDialog) return;
    const dealId = confirmDialog.deal.id;
    setActionLoading(dealId);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      if (res.ok) {
        toast.success(t('common.success'));
        setConfirmDialog(null);
        setSelectedDeal(null);
        fetchDeals();
      } else {
        toast.error(t('common.failed'));
        setConfirmDialog(null);
      }
    } catch {
      toast.error(t('common.serverError'));
      setConfirmDialog(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleWrongInfo = async () => {
    if (!confirmDialog) return;
    const dealId = confirmDialog.deal.id;
    setActionLoading(dealId);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, reason: 'wrong_info' }),
      });
      if (res.ok) {
        toast.success(t('status.wrongInfo'));
        setConfirmDialog(null);
        setSelectedDeal(null);
        fetchDeals();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.failed'));
        setConfirmDialog(null);
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
      setConfirmDialog(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelDeal = async () => {
    if (!confirmDialog) return;
    const dealId = confirmDialog.deal.id;
    setActionLoading(dealId);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, reason: 'cancel' }),
      });
      if (res.ok) {
        toast.success(t('status.cancelled'));
        setConfirmDialog(null);
        setSelectedDeal(null);
        fetchDeals();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.failed'));
        setConfirmDialog(null);
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
      setConfirmDialog(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateAmount = async () => {
    if (!selectedDeal) return;
    const num = Number(editedAmount);
    if (!num || num <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setIsUpdatingAmount(true);
    try {
      const res = await fetch(`/api/admin/deals/${selectedDeal.id}/update-payment-amount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentAmount: num }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(t('common.success'));
        // Update selectedDeal with new data
        setSelectedDeal({ ...selectedDeal, paymentAmount: data.deal?.paymentAmount });
        // Also update in deals list
        setDeals((prev) =>
          prev.map((d) => (d.id === selectedDeal.id ? { ...d, paymentAmount: data.deal?.paymentAmount } : d))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setIsUpdatingAmount(false);
    }
  };

  const pendingDeals = deals.filter(
    (d) => d.status === 'payment_pending'
  );

  /* ─── Detail View (shown when a deal is selected) ─── */
  if (selectedDeal) {
    const deal = selectedDeal;
    const shortId = deal.id.length > 10 ? 'DL-' + deal.id.slice(-5) : deal.id;
    const userName = deal.creator?.name || deal.buyer?.name || t('nav.user');
    const isActing = actionLoading === deal.id;
    const dealTime = new Date(deal.createdAt).toLocaleString('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div>
        {/* Back button + header */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setSelectedDeal(null)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            ফিরে যান
          </button>
        </div>

        <SolidCard className="!p-0 overflow-hidden">
          {/* Header */}
          <div className="border-b border-border/50 bg-muted/30 px-4 sm:px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 text-xs font-medium">
                {t('status.pending')}
              </Badge>
            </div>
            <p className="text-base font-bold text-foreground">{userName}</p>
            <p className="text-2xl font-extrabold text-foreground mt-1">৳{deal.amount.toLocaleString('en')}</p>
          </div>

          {/* Payment Proof Details */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Payment Method */}
            {deal.paymentMethod && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden">
                  {deal.paymentMethod.image ? (
                    <img
                      src={deal.paymentMethod.image}
                      alt={deal.paymentMethod.name}
                      className="h-full w-full object-cover"
                      loading="lazy" decoding="async"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span className={`text-xs font-bold ${deal.paymentMethod.image ? 'hidden' : ''}`}>
                    {deal.paymentMethod.name.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t('adminNav.paymentMethods')}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {deal.paymentMethod.name}
                    <span className="text-muted-foreground font-normal"> ({deal.paymentMethod.accountType === 'merchant' ? 'Merchant' : 'Personal'})</span>
                  </p>
                </div>
              </div>
            )}

            {/* Account Number (senderNumber) */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Sender Account</span>
              </div>
              <p className="text-lg font-bold font-mono text-foreground tracking-wide break-all">
                {deal.senderNumber || 'N/A'}
              </p>
            </div>

            {/* Transaction ID */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Transaction ID</span>
              </div>
              <p className="text-base font-bold font-mono text-foreground tracking-wide break-all">
                {deal.transactionId || 'দেওয়া হয়নি'}
              </p>
            </div>

            {/* Payment Amount (Editable) */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Pencil className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Payment Amount <span className="text-primary">(Editable)</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">৳</span>
                  <Input
                    type="number"
                    value={editedAmount}
                    onChange={(e) => setEditedAmount(e.target.value)}
                    className="h-11 pl-7 text-base font-bold font-mono pr-3"
                    min={1}
                    disabled={isActing || isUpdatingAmount}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleUpdateAmount}
                  disabled={isActing || isUpdatingAmount || !editedAmount || Number(editedAmount) <= 0 || Number(editedAmount) === (deal.paymentAmount || deal.amount)}
                  className="h-11 gap-1.5 px-3 shrink-0 rounded-lg"
                >
                  {isUpdatingAmount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  আপডেট
                </Button>
              </div>
              {/* Deal amount for comparison */}
              {deal.amount && Number(editedAmount) !== deal.amount && (
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Deal Amount:</span>
                  <span className="font-semibold text-foreground">৳{deal.amount.toLocaleString('en')}</span>
                  <span className="ml-auto rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    Differs
                  </span>
                </div>
              )}
            </div>

            {/* Time */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Payment Time</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{dealTime}</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {/* Row 1: Verify */}
              <Button
                size="lg"
                disabled={isActing}
                onClick={() => setConfirmDialog({ type: 'verify', deal })}
                className="w-full h-13 gap-2 rounded-xl text-base font-bold shadow-lg shadow-primary/25"
              >
                {isActing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                Verify Payment
              </Button>

              {/* Row 2: Wrong Info + Cancel */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  disabled={isActing}
                  onClick={() => setConfirmDialog({ type: 'wrong_info', deal })}
                  className="h-12 gap-2 rounded-xl text-sm font-semibold border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800/50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Wrong Info
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  disabled={isActing}
                  onClick={() => setConfirmDialog({ type: 'cancel', deal })}
                  className="h-12 gap-2 rounded-xl text-sm font-semibold border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <ShieldX className="h-4 w-4" />
                  Cancel Deal
                </Button>
              </div>
            </div>

            {/* ─── Verify Confirmation Dialog ─── */}
            <AlertDialog open={!!confirmDialog && confirmDialog.type === 'verify' && confirmDialog.deal.id === deal.id} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Verify Payment?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span>Are you sure you want to verify this payment?</span>
                    <span className="block rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1.5">
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('nav.user')}</span>
                        <span className="font-semibold text-foreground">{userName}</span>
                      </span>
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deal Amount</span>
                        <span className="font-semibold text-foreground">৳{deal.amount.toLocaleString('en')}</span>
                      </span>
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payment Amount</span>
                        <span className="font-bold text-foreground">৳{Number(editedAmount).toLocaleString('en')}</span>
                      </span>
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deal ID</span>
                        <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
                      </span>
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">⚠️ Once verified, this cannot be changed.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isActing}>{t('common.cancel')}</AlertDialogCancel>
                  <Button
                    onClick={handleVerify}
                    disabled={isActing}
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                  >
                    {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Yes, Verify
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* ─── Wrong Info Confirmation Dialog ─── */}
            <AlertDialog open={!!confirmDialog && confirmDialog.type === 'wrong_info' && confirmDialog.deal.id === deal.id} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Mark as Wrong Info?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span>If payment info is wrong, the deal will be <strong className="text-amber-600 dark:text-amber-400">recreated</strong> and the buyer can submit payment again.</span>
                    <span className="block rounded-xl border border-amber-200/50 bg-amber-50/50 dark:bg-amber-500/5 p-3 space-y-1.5">
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">ইউজার</span>
                        <span className="font-semibold text-foreground">{userName}</span>
                      </span>
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-bold text-foreground">৳{deal.amount.toLocaleString('en')}</span>
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">📌 Payment info will be removed but the deal won't be cancelled.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isActing}>না</AlertDialogCancel>
                  <Button
                    onClick={handleWrongInfo}
                    disabled={isActing}
                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                  >
                    {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    Yes, Wrong Info
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* ─── Cancel Deal Confirmation Dialog ─── */}
            <AlertDialog open={!!confirmDialog && confirmDialog.type === 'cancel' && confirmDialog.deal.id === deal.id} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <ShieldX className="h-5 w-5 text-red-500" />
                    Cancel Deal?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span>The deal will be permanently <strong className="text-red-600 dark:text-red-400">cancelled</strong>. This cannot be undone.</span>
                    <span className="block rounded-xl border border-red-200/50 bg-red-50/50 dark:bg-red-500/5 p-3 space-y-1.5">
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">ইউজার</span>
                        <span className="font-semibold text-foreground">{userName}</span>
                      </span>
                      <span className="flex justify-between text-sm">
                        <span className="text-muted-foreground">পরিমাণ</span>
                        <span className="font-bold text-foreground">৳{deal.amount.toLocaleString('en')}</span>
                      </span>
                    </span>
                    <span className="text-xs text-red-600 dark:text-red-400">⚠️ This action cannot be undone.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isActing}>না</AlertDialogCancel>
                  <Button
                    onClick={handleCancelDeal}
                    disabled={isActing}
                    className="gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl"
                  >
                    {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                    Yes, Cancel
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SolidCard>
      </div>
    );
  }

  /* ─── List View (default) ─── */
  return (
    <div>
      {/* Section Header */}
      <div className="mb-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Payment Verification
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review deals pending verification
          </p>
        </div>
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 text-xs font-medium">
          {pendingDeals.length} {t('status.pending')}
        </Badge>
      </div>

      {/* Desktop Table */}
      <SolidCard className="!p-0 overflow-hidden hidden lg:block">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="mb-3 h-10 w-10 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              All payments verified
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No pending deals
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Deal ID
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  User
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Amount (৳)
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {pendingDeals.map((deal) => {
                const shortId =
                  deal.id.length > 10
                    ? 'DL-' + deal.id.slice(-5)
                    : deal.id;
                const userName =
                  deal.creator?.name || deal.buyer?.name || 'ইউজার';

                return (
                  <tr
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="border-b border-border/30 transition-colors hover:bg-muted/20 last:border-0 cursor-pointer"
                  >
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {shortId}
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap">
                      {userName}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-foreground whitespace-nowrap">
                      ৳{deal.amount.toLocaleString('en')}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">
                        {t('status.pending')}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SolidCard>

      {/* Mobile Cards — clickable, no action buttons */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="mb-3 h-10 w-10 text-primary" />
            <p className="text-sm font-semibold text-foreground">সব পেমেন্ট ভেরিফাই হয়েছে</p>
          </div>
        ) : (
          pendingDeals.map((deal) => {
            const shortId = deal.id.length > 10 ? 'DL-' + deal.id.slice(-5) : deal.id;
            const userName = deal.creator?.name || deal.buyer?.name || 'ইউজার';
            return (
              <SolidCard
                key={deal.id}
                className="!p-0 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => setSelectedDeal(deal)}
              >
                <div className="p-3.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 text-[10px]">{t('status.pending')}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                  </div>
                  <p className="text-lg font-bold text-foreground ml-3">৳{deal.amount.toLocaleString('en')}</p>
                </div>
              </SolidCard>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel 3: সকল ডিল
   ═══════════════════════════════════════════ */

type DealFilter = 'all' | 'pending' | 'verified' | 'delivery' | 'completed';

function AllDealsPanel() {
  const t = useT();

  const dealFilterTabs: {
    key: DealFilter;
    label: string;
    statuses: string[];
  }[] = [
    { key: 'all', label: 'All', statuses: [] },
    {
      key: 'pending',
      label: t('status.pending'),
      statuses: ['created', 'pending', 'payment_pending'],
    },
    { key: 'verified', label: t('status.verified'), statuses: ['payment_verified'] },
    {
      key: 'delivery',
      label: t('status.inDelivery'),
      statuses: ['in_delivery', 'delivery_confirmed'],
    },
    { key: 'completed', label: t('status.completed'), statuses: ['completed', 'rejected', 'cancelled'] },
  ];

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<DealFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatDeal, setChatDeal] = useState<DealRow | null>(null);
  const [messages, setMessages] = useState<AdminChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deals');
      if (res.ok) {
        const data = await res.json();
        setDeals(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  /* ── Chat: fetch messages when a deal is selected ── */
  useEffect(() => {
    if (!chatDeal) return;
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/admin/deals/${encodeURIComponent(chatDeal.id)}/chat`);
        if (res.ok) setMessages(await res.json());
      } catch { /* ignore */ }
    };
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [chatDeal]);

  /* No auto-scroll on incoming — only on admin send */

  const handleSend = async () => {
    if (!chatInput.trim() || !chatDeal || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/deals/${encodeURIComponent(chatDeal.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatInput }),
      });
      if (res.ok) {
        setChatInput('');
        const msgRes = await fetch(`/api/admin/deals/${encodeURIComponent(chatDeal.id)}/chat`);
        if (msgRes.ok) {
          setMessages(await msgRes.json());
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const filteredDeals = deals.filter((deal) => {
    const tab = dealFilterTabs.find((t) => t.key === activeFilter);
    const matchesStatus =
      !tab ||
      tab.statuses.length === 0 ||
      tab.statuses.includes(deal.status);
    const shortId = 'DL-' + deal.id.slice(-5);
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      deal.title.toLowerCase().includes(q) ||
      shortId.toLowerCase().includes(q) ||
      deal.id.includes(q);
    return matchesStatus && matchesSearch;
  });

  /* ── Chat View ── */
  if (chatDeal) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setChatDeal(null); setMessages([]); setChatInput(''); }}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{chatDeal.title}</p>
            <p className="text-xs text-muted-foreground">
              {chatDeal.buyer?.name || '—'} — {chatDeal.seller?.name || 'N/A'} · ৳{chatDeal.amount.toLocaleString('en')}
            </p>
          </div>
          <span className="font-mono text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-lg">
            DL-{chatDeal.id.slice(-5)}
          </span>
        </div>

        <SolidCard className="flex flex-col !p-0 overflow-hidden">
          <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 min-h-[400px] max-h-[60vh] overflow-y-auto p-4 space-y-3 bg-muted/30" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No messages</p>
              </div>
            )}
            {messages.map((msg) => <AdminChatBubble key={msg.id} msg={msg} />)}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-border/50 px-4 py-3 bg-card">
            <div className="flex items-center gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Write a message..."
                className="flex-1 h-10 rounded-xl text-sm"
              />
              <Button
                onClick={handleSend}
                disabled={!chatInput.trim() || sending}
                size="sm"
                className="h-10 rounded-xl px-4 gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                <span className="hidden sm:inline">Send</span>
              </Button>
            </div>
          </div>
        </SolidCard>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          All Deals
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-center sm:text-left">
          Complete list of all platform deals
        </p>
      </div>

      {/* Filter Tabs + Search */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap justify-center gap-2">
          {dealFilterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                activeFilter === tab.key
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-white text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground dark:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 dark:bg-zinc-800 flex-1 sm:flex-none">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by deal ID or title..."
            className="w-full sm:w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <SolidCard className="!p-0 overflow-hidden hidden lg:block">
        {loading ? (
          <LoadingSpinner />
        ) : filteredDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="mb-3 h-10 w-10 text-primary" />
            <p className="text-sm font-semibold text-foreground">No deals found</p>
            <p className="mt-1 text-xs text-muted-foreground">No deals in this filter</p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">ডিল আইডি</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Buyer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Seller</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Title</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Amount</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => {
                  const shortId = deal.id.length > 10 ? 'DL-' + deal.id.slice(-5) : deal.id;
                  const buyerName = deal.buyer?.name || '—';
                  const sellerName = deal.seller?.name || 'N/A';
                  return (
                    <tr key={deal.id} className="border-b border-border/30 transition-colors hover:bg-muted/20 last:border-0">
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{shortId}</td>
                      <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap">{buyerName}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{sellerName}</td>
                      <td className="px-5 py-4 text-foreground max-w-[160px] truncate">{deal.title}</td>
                      <td className="px-5 py-4 text-right font-semibold text-foreground whitespace-nowrap">৳{deal.amount.toLocaleString('en')}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap"><StatusBadge status={deal.status} /></td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setChatDeal(deal)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-semibold transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          চ্যাট
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SolidCard>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <LoadingSpinner />
        ) : filteredDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="mb-3 h-10 w-10 text-primary" />
            <p className="text-sm font-semibold text-foreground">কোনো ডিল পাওয়া যায়নি</p>
          </div>
        ) : (
          filteredDeals.map((deal) => {
            const shortId = deal.id.length > 10 ? 'DL-' + deal.id.slice(-5) : deal.id;
            const buyerName = deal.buyer?.name || '—';
            const sellerName = deal.seller?.name || 'অনির্ধারিত';
            return (
              <SolidCard key={deal.id} className="!p-0">
                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
                    <StatusBadge status={deal.status} />
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <p>Buyer: <span className="text-foreground font-medium">{buyerName}</span></p>
                      <p>Seller: <span className="text-foreground font-medium">{sellerName}</span></p>
                    </div>
                    <span className="text-base font-bold text-foreground">৳{deal.amount.toLocaleString('en')}</span>
                  </div>
                  <button
                    onClick={() => setChatDeal(deal)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 text-xs font-semibold transition-colors mt-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat
                  </button>
                </div>
              </SolidCard>
            );
          })
        )}
      </div>
    </div>
  );
}



/* ═══════════════════════════════════════════
   Panel 4: ইউজার ম্যানেজমেন্ট
   ═══════════════════════════════════════════ */

function UsersPanel() {
  const t = useT();

  const STAFF_PERMISSION_OPTIONS = [
    { value: 'payment-verify', label: t('adminNav.paymentVerify'), desc: 'Verify and approve payments' },
    { value: 'payouts', label: t('adminNav.payoutManagement'), desc: 'Approve and process payouts' },
    { value: 'admin-calls', label: t('adminNav.liveChat'), desc: 'Live chat and calls with users' },
    { value: 'disputes', label: t('adminNav.disputeManagement'), desc: 'Dispute handling' },
    { value: 'payment-methods', label: t('adminNav.paymentMethods'), desc: 'Add/edit payment methods' },
    { value: 'fee-rules', label: t('adminNav.feeRules'), desc: 'Change fee rules' },
    { value: 'all-deals', label: t('adminNav.allDeals'), desc: 'View and manage all deals' },
    { value: 'users', label: t('adminNav.userManagement'), desc: 'User list, Change Password' },
    { value: 'contact-info', label: t('adminNav.contact'), desc: 'Contact info settings' },
    { value: 'settings', label: t('adminNav.websiteSettings'), desc: 'General site settings' },
    { value: 'contract', label: t('adminNav.contract'), desc: 'Edit contract template' },
    { value: 'blog', label: t('adminNav.blog'), desc: 'Write and manage blog posts' },
    { value: 'email-settings', label: t('adminNav.emailSettings'), desc: 'Email configuration' },
  ];
  type RoleFilter = 'all' | 'super_admin' | 'support' | 'staff' | 'user';

  const ROLE_TABS: { key: RoleFilter; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: t('adminUsers.all'), icon: Users },
    { key: 'super_admin', label: t('adminUsers.superAdmin'), icon: Shield },
    { key: 'support', label: t('adminUsers.support'), icon: Headphones },
    { key: 'staff', label: t('adminUsers.staff'), icon: UserCog },
    { key: 'user', label: t('adminUsers.generalUser'), icon: User },
  ];

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [viewUserDeals, setViewUserDeals] = useState(false);
  const [userDeals, setUserDeals] = useState<Array<{id:string;title:string;amount:number;status:string;createdAt:string}>>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  // Staff permission dialog state
  const [staffPermDialog, setStaffPermDialog] = useState<{ userId: string; userName: string; currentPerms: string[] } | null>(null);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (userId: string, action: string, value?: string | boolean) => {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, value }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || t('common.success'));
        fetchUsers();
        // Update selectedUser if viewing the same user
        if (selectedUser?.id === userId) {
          setSelectedUser((prev) =>
            prev
              ? { ...prev, isActive: action === 'toggle_active' ? (value as boolean) : prev.isActive }
              : null
          );
          if (action === 'change_password') setNewPassword('');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setActionLoading(null);
      setOpenDropdown(null);
    }
  };

  const handleViewUserPanel = async () => {
    if (!selectedUser || selectedUser.isAdmin) return;
    setViewUserDeals(true);
    setDealsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/deals`);
      if (res.ok) {
        const data = await res.json();
        setUserDeals(data);
      }
    } catch {
      toast.error('Failed to load user data');
    } finally {
      setDealsLoading(false);
    }
  };

  // Count users per role
  const roleCounts = users.reduce((acc, u) => {
    if (u.isAdmin && u.adminRole === 'super_admin') acc.super_admin++;
    else if (u.isAdmin && u.adminRole === 'support') acc.support++;
    else if (u.isAdmin && u.adminRole === 'staff') acc.staff++;
    else acc.user++;
    return acc;
  }, { super_admin: 0, support: 0, staff: 0, user: 0 });

  const filteredUsers = users.filter((u) => {
    // Role filter
    if (roleFilter === 'super_admin') return u.isAdmin && u.adminRole === 'super_admin';
    if (roleFilter === 'support') return u.isAdmin && u.adminRole === 'support';
    if (roleFilter === 'staff') return u.isAdmin && u.adminRole === 'staff';
    if (roleFilter === 'user') return !u.isAdmin;
    // Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.phone.includes(q) || u.name.toLowerCase().includes(q);
  });

  /* ─── Detail View ─── */
  if (selectedUser) {
    const u = selectedUser;
    const isActing = actionLoading === u.id;
    return (
      <div>
        {/* Back button */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => { setSelectedUser(null); setNewPassword(''); setShowPassword(false); setViewUserDeals(false); setUserDeals([]); }}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            ফিরে যান
          </button>
        </div>

        <SolidCard className="!p-0">
          {/* Header */}
          <div className="border-b border-border/50 bg-muted/30 px-4 sm:px-5 py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-primary">{u.name.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foreground truncate">{u.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge isAdmin={u.isAdmin} adminRole={u.adminRole} adminPermissions={u.adminPermissions} />
                  {u.isAdmin ? null : (
                    <Badge className={`${u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'} border-0 text-xs font-medium`}>
                      {u.isActive ? t('status.active') : t('status.cancelled')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Email */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">ইমেইল</span>
              </div>
              <p className="text-sm font-semibold text-foreground break-all">{u.email}</p>
            </div>

            {/* Phone */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Mobile Number</span>
              </div>
              <p className="text-sm font-semibold text-foreground font-mono">{u.phone}</p>
            </div>

            {/* Join Date */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Join Date</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {new Date(u.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Change Password */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">পাসওয়ার্ড পরিবর্তন</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newPassword.trim()) handleAction(u.id, 'change_password', newPassword); }}
                    className="h-10 text-sm rounded-lg"
                    disabled={isActing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  size="sm"
                  disabled={isActing || !newPassword.trim()}
                  onClick={() => handleAction(u.id, 'change_password', newPassword)}
                  className="h-10 gap-1.5 rounded-lg text-xs font-semibold shrink-0"
                >
                  {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  সেভ
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            {!u.isAdmin && (
              <>
                {/* View User Panel */}
                <Button
                  size="lg"
                  variant="outline"
                  disabled={isActing}
                  onClick={handleViewUserPanel}
                  className="w-full h-12 gap-2 rounded-xl text-sm font-semibold"
                >
                  <Eye className="h-4 w-4" />
                  View User Panel
                </Button>

                {/* Deactivate/Activate */}
                <Button
                  size="lg"
                  disabled={isActing}
                  onClick={() => handleAction(u.id, 'toggle_active', !u.isActive)}
                  variant={u.isActive ? 'outline' : 'default'}
                  className={`w-full h-12 gap-2 rounded-xl text-sm font-bold ${
                    u.isActive
                      ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-500/10'
                      : 'shadow-lg shadow-primary/25'
                  }`}
                >
                  {isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : u.isActive ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  {u.isActive ? 'Deactivate User' : 'Activate User'}
                </Button>
              </>
            )}

            {/* Admin Role Management (for non-admin users) */}
            {!u.isAdmin && (
              <div className="pt-1">
                <div className="relative inline-block w-full">
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={isActing}
                    onClick={() => setOpenDropdown(openDropdown === u.id ? null : u.id)}
                    className="w-full h-11 gap-2 rounded-xl text-sm font-semibold"
                  >
                    <Settings className="h-4 w-4" />
                    Assign Admin Role
                    <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${openDropdown === u.id ? 'rotate-180' : ''}`} />
                  </Button>
                  {openDropdown === u.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border bg-white p-1.5 shadow-lg dark:bg-zinc-800"
                    >
                      <button
                        onClick={() => handleAction(u.id, 'set_admin', 'support')}
                        disabled={isActing}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        Support Admin
                      </button>
                      <button
                        onClick={() => handleAction(u.id, 'set_admin', 'super_admin')}
                        disabled={isActing}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        Super Admin
                      </button>
                      <button
                        onClick={() => {
                          handleAction(u.id, 'set_admin', 'staff');
                        }}
                        disabled={isActing}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 disabled:opacity-50"
                      >
                        Staff
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Staff Permission Editor (for staff role users) */}
            {u.isAdmin && u.adminRole === 'staff' && (
              <div className="pt-1">
                <Button
                  size="lg"
                  variant="outline"
                  disabled={isActing}
                  onClick={() => {
                    setTempPermissions([...u.adminPermissions]);
                    setStaffPermDialog({ userId: u.id, userName: u.name, currentPerms: [...u.adminPermissions] });
                  }}
                  className="w-full h-11 gap-2 rounded-xl text-sm font-semibold border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Manage Permissions
                  {(u.adminPermissions || []).length > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[10px] ml-auto px-1.5">
                      {(u.adminPermissions || []).length}
                    </Badge>
                  )}
                </Button>
              </div>
            )}

            {/* Remove admin (for admin users) */}
            {u.isAdmin && (
              <div className="pt-1">
                <Button
                  size="lg"
                  variant="outline"
                  disabled={isActing}
                  onClick={() => handleAction(u.id, 'remove_admin')}
                  className="w-full h-11 gap-2 rounded-xl text-sm font-medium border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <XCircle className="h-4 w-4" />
                  Remove Admin Role
                </Button>
              </div>
            )}
          </div>
        </SolidCard>

        {/* ─── User Deals Panel (View User Panel) ─── */}
        {viewUserDeals && (
          <div className="mt-4">
            <SolidCard className="!p-0 overflow-hidden">
              <div className="border-b border-border/50 bg-muted/30 px-4 sm:px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{u.name} — Deals</h3>
                </div>
                <button
                  onClick={() => setViewUserDeals(false)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {dealsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : userDeals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <Handshake className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">This user has no deals</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {userDeals.map((d) => (
                      <div key={d.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{d.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(d.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">৳{d.amount.toLocaleString('en')}</p>
                          <StatusBadge status={d.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SolidCard>
          </div>
        )}
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
          <Users className="h-5 w-5 text-primary" />
          User Management
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-center sm:text-left">
          List and management of all registered users
        </p>
      </div>

      {/* Role Category Tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {ROLE_TABS.map((tab) => {
          const count = tab.key === 'all' ? users.length : (roleCounts as Record<string, number>)[tab.key] ?? 0;
          const active = roleFilter === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setRoleFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              <span className={`${active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-foreground/10 text-muted-foreground'} text-[10px] font-bold px-1.5 py-0.5 rounded-md`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by email or mobile..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 rounded-xl text-sm bg-white dark:bg-zinc-900"
        />
      </div>

      {/* Desktop Table */}
      <SolidCard className="!p-0 overflow-hidden hidden lg:block">
        {loading ? (
          <LoadingSpinner />
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? 'No users found' : 'No users'}
            </p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">ইমেইল</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Mobile</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">স্ট্যাটাস</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">নিবন্ধনের তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="border-b border-border/30 transition-colors hover:bg-muted/20 last:border-0 cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{u.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate whitespace-nowrap">{u.name}</p>
                          <RoleBadge isAdmin={u.isAdmin} adminRole={u.adminRole} adminPermissions={u.adminPermissions} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{u.email}</td>
                    <td className="px-5 py-4 text-muted-foreground font-mono whitespace-nowrap">{u.phone}</td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <Badge className={`${u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'} border-0 text-xs font-medium`}>
                        {u.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(u.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SolidCard>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <LoadingSpinner />
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? 'কোনো ইউজার পাওয়া যায়নি' : 'কোনো ইউজার নেই'}
            </p>
          </div>
        ) : (
          filteredUsers.map((u) => (
            <SolidCard
              key={u.id}
              className="!p-0 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => setSelectedUser(u)}
            >
              <div className="p-3.5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{u.name.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                    <RoleBadge isAdmin={u.isAdmin} adminRole={u.adminRole} adminPermissions={u.adminPermissions} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground font-mono">{u.phone}</p>
                </div>
                <Badge className={`${u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'} border-0 text-[10px] font-medium shrink-0`}>
                  {u.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </Badge>
              </div>
            </SolidCard>
          ))
        )}
      </div>

      {/* ─── Staff Permission Dialog ─── */}
      {staffPermDialog && (
        <AlertDialog open={!!staffPermDialog} onOpenChange={(open) => { if (!open) setStaffPermDialog(null); }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Set Staff Permissions
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="text-foreground font-semibold">{staffPermDialog.userName}</span> — নিচের প্যানেলগুলোতে অ্যাক্সেস দিন
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 mt-2 custom-scrollbar">
              {STAFF_PERMISSION_OPTIONS.map((opt) => {
                const checked = tempPermissions.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                      checked ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setTempPermissions((prev) =>
                          checked ? prev.filter((p) => p !== opt.value) : [...prev, opt.value]
                        );
                      }}
                      className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 px-1">
              <span>Note: Dashboard and Profile are always accessible</span>
              <span className="font-semibold text-foreground">{tempPermissions.length}টি নির্বাচিত</span>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={permSaving}>বাতিল</AlertDialogCancel>
              <Button
                onClick={async () => {
                  setPermSaving(true);
                  try {
                    const res = await fetch('/api/admin/users/role', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: staffPermDialog.userId,
                        action: 'set_staff_permissions',
                        value: tempPermissions,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      toast.success(data.message || 'Permissions set');
                      setStaffPermDialog(null);
                      fetchUsers();
                    } else {
                      const data = await res.json().catch(() => ({}));
                      toast.error(data.error || 'ব্যর্থ');
                    }
                  } catch {
                    toast.error('সার্ভারে সমস্যা');
                  } finally {
                    setPermSaving(false);
                  }
                }}
                disabled={permSaving}
                className="gap-2"
              >
                {permSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel 5: ওয়েবসাইট সেটিংস
   ═══════════════════════════════════════════ */

function SettingsPanel() {
  const t = useT();
  const [settings, setSettings] = useState<PlatformSettings>({
    platform_name: '',
    site_logo: '',
    fee_percentage: '',
    min_deal_amount: '',
    max_deal_amount: '',
    support_number: '',
    footer_description: '',
    footer_copyright_text: '',
    footer_made_in: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        invalidateSiteSettingsCache();
        toast.success(t('common.success'));
      } else {
        toast.error(t('common.failed'));
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setSettings((s) => ({ ...s, site_logo: data.logoPath }));
        invalidateSiteSettingsCache();
        toast.success('Logo updated!');
      } else {
        toast.error('Upload Logo ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const fields: {
    key: keyof PlatformSettings;
    label: string;
    type: string;
    placeholder: string;
  }[] = [
    {
      key: 'platform_name',
      label: 'প্ল্যাটফর্মের নাম',
      type: 'text',
      placeholder: 'আমার ডিল',
    },
    {
      key: 'fee_percentage',
      label: 'ফি শতাংশ (%)',
      type: 'number',
      placeholder: '৩',
    },
    {
      key: 'min_deal_amount',
      label: 'ন্যূনতম ডিল পরিমাণ (৳)',
      type: 'number',
      placeholder: '১০০',
    },
    {
      key: 'max_deal_amount',
      label: 'সর্বোচ্চ ডিল পরিমাণ (৳)',
      type: 'number',
      placeholder: '১০০০০০০',
    },
    {
      key: 'support_number',
      label: 'সাপোর্ট নাম্বার',
      type: 'text',
      placeholder: '০১৭০০০০০০০০',
    },
    {
      key: 'footer_description',
      label: 'ফুটার বিবরণ',
      type: 'textarea',
      placeholder: 'আপনার প্ল্যাটফর্মের সম্পর্কে একটি সংক্ষিপ্ত বিবরণ লিখুন...',
    },
    {
      key: 'footer_copyright_text',
      label: 'ফুটার কপিরাইট লাইন',
      type: 'text',
      placeholder: '© ২০২৬ আমার ডিল। সর্বস্বত্ব সংরক্ষিত।',
    },
    {
      key: 'footer_made_in',
      label: 'ফুটার "তৈরি" টেক্সট',
      type: 'text',
      placeholder: 'বাংলাদেশে তৈরি',
    },
  ];

  const generalFields = fields.filter(f => !f.key.startsWith('footer_'));
  const footerSettingsFields = fields.filter(f => f.key.startsWith('footer_'));

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Website Settings
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-center sm:text-left">
          General escrow platform configuration
        </p>
      </div>

      {/* Settings Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        {/* ── Brand Settings (Logo + Name) ── */}
        <SolidCard>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Brand Settings</p>
              <p className="text-[11px] text-muted-foreground">Change logo and website name</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Logo Upload */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[240px_1fr] sm:items-start">
              <Label className="text-sm font-medium text-foreground text-center sm:text-left pt-2.5">
                Website Logo
              </Label>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {settings.site_logo ? (
                    <img
                      src={settings.site_logo}
                      alt="লোগো"
                      className="h-full w-full object-contain p-1"
                      loading="lazy" decoding="async"
                    />
                  ) : (
                    <CreditCard className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                      {logoUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {logoUploading ? 'Uploading...' : 'লোগো আপলোড'}
                    </span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">PNG, JPG — সর্বোচ্চ ২MB</span>
                </div>
              </div>
            </div>

            {/* Platform Name */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[240px_1fr] sm:items-center">
              <Label htmlFor="platform_name" className="text-sm font-medium text-foreground text-center sm:text-left">
                Website Name
              </Label>
              <Input
                id="platform_name"
                type="text"
                value={settings.platform_name}
                onChange={(e) =>
                  setSettings({ ...settings, platform_name: e.target.value })
                }
                placeholder="আমার ডিল"
                className="max-w-sm"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-center sm:justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md shadow-primary/20"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Brand
            </Button>
          </div>
        </SolidCard>

        {/* ── General Settings ── */}
        <SolidCard>
          <div className="space-y-5">
            {generalFields.map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[240px_1fr] sm:items-center"
              >
                <Label
                  htmlFor={field.key}
                  className="text-sm font-medium text-foreground text-center sm:text-left"
                >
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={settings[field.key]}
                  onChange={(e) =>
                    setSettings({ ...settings, [field.key]: e.target.value })
                  }
                  placeholder={field.placeholder}
                  className="max-w-sm"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center sm:justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md shadow-primary/20"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </SolidCard>

        {/* ── Footer Settings ── */}
        <SolidCard>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Footer Settings</p>
              <p className="text-[11px] text-muted-foreground">Change homepage footer info</p>
            </div>
          </div>

          <div className="space-y-5">
            {footerSettingsFields.map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[240px_1fr]"
              >
                <Label
                  htmlFor={field.key}
                  className="text-sm font-medium text-foreground text-center sm:text-left pt-2.5"
                >
                  {field.label}
                </Label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={field.key}
                    value={settings[field.key]}
                    onChange={(e) =>
                      setSettings({ ...settings, [field.key]: e.target.value })
                    }
                    placeholder={field.placeholder}
                    rows={3}
                    className="max-w-sm w-full rounded-xl border border-border/50 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={settings[field.key]}
                    onChange={(e) =>
                      setSettings({ ...settings, [field.key]: e.target.value })
                    }
                    placeholder={field.placeholder}
                    className="max-w-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center sm:justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md shadow-primary/20"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Footer
            </Button>
          </div>
        </SolidCard>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel: পেআউট ম্যানেজমেন্ট
   ═══════════════════════════════════════════ */

interface PayoutRow {
  id: string;
  dealId: string;
  type: string;
  recipientId: string;
  amount: number;
  accountType: string;
  accountNumber: string;
  accountName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  recipient: { id: string; name: string; email: string; phone: string } | null;
  deal: { id: string; title: string; status: string; amount: number; paymentAmount?: number | null; platformFee?: number | null; sellerId: string; buyerId: string } | null;
}

function PayoutsPanel() {
  const t = useT();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'all'>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRow | null>(null);
  const [showPaidConfirm, setShowPaidConfirm] = useState(false);

  const fetchPayouts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payouts');
      if (res.ok) {
        const data = await res.json();
        setPayouts(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleMarkPaid = async (payoutId: string) => {
    setActingId(payoutId);
    try {
      const res = await fetch(`/api/admin/payouts/${encodeURIComponent(payoutId)}/mark-paid`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success(t('common.success'));
        setSelectedPayout(null);
        fetchPayouts();
      } else {
        toast.error(t('common.failed'));
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setActingId(null);
    }
  };

  const filteredPayouts = payouts.filter((p) => {
    if (activeTab === 'pending') return p.status === 'pending';
    if (activeTab === 'paid') return p.status === 'paid';
    return true;
  });

  const pendingCount = payouts.filter((p) => p.status === 'pending').length;
  const paidCount = payouts.filter((p) => p.status === 'paid').length;

  /* ─── Detail View ─── */
  if (selectedPayout) {
    const p = selectedPayout;
    const isActing = actingId === p.id;
    const pTime = new Date(p.createdAt).toLocaleString('en', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const paidTime = p.status === 'paid' ? new Date(p.updatedAt).toLocaleString('en', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }) : null;
    const shortDealId = p.dealId.length > 10 ? 'DL-' + p.dealId.slice(-5) : p.dealId;
    const isRefund = p.type === 'buyer_refund';

    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setSelectedPayout(null)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            ফিরে যান
          </button>
        </div>

        <SolidCard className="!p-0 overflow-hidden">
          {/* Header */}
          <div className="border-b border-border/50 bg-muted/30 px-4 sm:px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-muted-foreground">{shortDealId}</span>
              {p.status === 'paid' ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-xs font-medium">
                  Payment Complete
                </Badge>
              ) : (
                <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0 text-xs font-medium">
                  পেন্ডিং
                </Badge>
              )}
            </div>
            <p className="text-base font-bold text-foreground">
              {isRefund ? 'Refund Request' : 'Seller Payout'}
            </p>
            <p className="text-2xl font-extrabold text-foreground mt-1">৳{p.amount.toLocaleString('en')}</p>
          </div>

          {/* Details */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Recipient Info */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Recipient</p>
                <p className="text-sm font-semibold text-foreground">{p.recipient?.name || 'অজানা'}</p>
                <p className="text-xs text-muted-foreground">{p.recipient?.phone || ''}</p>
              </div>
            </div>

            {/* Bank Details */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Payout Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Payment Method</p>
                  <p className="text-sm font-semibold text-foreground">{p.accountType}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Account Number</p>
                  <p className="text-sm font-semibold font-mono text-foreground">{p.accountNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Account Name</p>
                  <p className="text-sm font-semibold text-foreground">{p.accountName}</p>
                </div>
              </div>
            </div>

            {/* Deal Info */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Handshake className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Deal Info</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground">ডিল আইডি</p>
                  <p className="font-mono font-medium text-foreground">{shortDealId}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Deal Amount</p>
                  <p className="font-semibold text-foreground">৳{p.deal?.amount.toLocaleString('en') || '—'}</p>
                </div>
                {p.deal?.paymentAmount != null && p.deal.paymentAmount !== p.deal.amount && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground">Actual Payment Amount (excl. fee)</p>
                    <p className="font-bold text-primary">৳{p.deal.paymentAmount.toLocaleString('en')}</p>
                  </div>
                )}
              </div>
              {p.deal?.title && (
                <div>
                  <p className="text-[10px] text-muted-foreground">Deal Title</p>
                  <p className="text-sm font-medium text-foreground">{p.deal.title}</p>
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Time</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested</span>
                  <span className="font-medium text-foreground">{pTime}</span>
                </div>
                {paidTime && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">পেমেন্ট সম্পন্ন</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{paidTime}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button — only for pending */}
            {p.status === 'pending' && (
              <div className="pt-2">
                <Button
                  onClick={() => setShowPaidConfirm(true)}
                  disabled={isActing}
                  className="w-full h-12 gap-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Mark as Paid
                </Button>
                <AlertDialog open={showPaidConfirm} onOpenChange={(open) => { if (!open) setShowPaidConfirm(false); }}>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                        Mark as Paid?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <span>Are you sure you want to mark this payout as paid?</span>
                        <span className="block rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1.5">
                          <span className="flex justify-between text-sm">
                            <span className="text-muted-foreground">প্রাপক</span>
                            <span className="font-semibold text-foreground">{p.recipient?.name || 'অজানা'}</span>
                          </span>
                          <span className="flex justify-between text-sm">
                            <span className="text-muted-foreground">পরিমাণ</span>
                            <span className="font-bold text-foreground">৳{p.amount.toLocaleString('en')}</span>
                          </span>
                          <span className="flex justify-between text-sm">
                            <span className="text-muted-foreground">একাউন্ট</span>
                            <span className="font-mono text-xs text-foreground">{p.accountNumber} ({p.accountName})</span>
                          </span>
                        </span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">✅ পেমেন্ট ডান করলে ইউজারের ডিলে "পেআউট সম্পন্ন" দেখাবে।</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isActing}>বাতিল</AlertDialogCancel>
                      <Button
                        onClick={() => handleMarkPaid(p.id)}
                        disabled={isActing}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                      >
                        {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        হ্যাঁ, পেমেন্ট ডান করুন
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </SolidCard>
      </div>
    );
  }

  /* ─── List View ─── */
  const tabs: { key: 'pending' | 'paid' | 'all'; label: string; count: number }[] = [
    { key: 'pending', label: 'পেন্ডিং', count: pendingCount },
    { key: 'paid', label: 'সম্পন্ন', count: paidCount },
    { key: 'all', label: 'সকল', count: payouts.length },
  ];

  return (
    <div>
      {/* Section Header */}
      <div className="mb-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            পেআউট ম্যানেজমেন্ট
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            ইউজারদের পেআউট ও ফেরতের অনুরোধ পর্যালোচনা করুন
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0 text-xs font-medium">
            {pendingCount} পেন্ডিং
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-muted/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <SolidCard className="!p-0 overflow-hidden hidden lg:block">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPayouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Banknote className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">কোনো পেআউট নেই</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTab === 'pending' ? 'বর্তমানে কোনো পেন্ডিং পেআউট নেই' : 'এখানে কোনো পেআউট দেখা যাচ্ছে না'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">প্রাপক</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">ধরন</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">পরিমাণ (৳)</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">একাউন্ট</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map((payout) => {
                const isRefund = payout.type === 'buyer_refund';
                return (
                  <tr
                    key={payout.id}
                    onClick={() => setSelectedPayout(payout)}
                    className="border-b border-border/30 transition-colors hover:bg-muted/20 last:border-0 cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{payout.recipient?.name || 'অজানা'}</p>
                      <p className="text-xs text-muted-foreground">{payout.recipient?.phone || ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={`border-0 text-[10px] font-medium ${isRefund ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : 'bg-primary/10 text-primary'}`}>
                        {isRefund ? 'ফেরত' : 'পেআউট'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-foreground whitespace-nowrap">
                      ৳{payout.amount.toLocaleString('en')}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p className="text-xs font-medium text-foreground">{payout.accountType}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{payout.accountNumber}</p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {payout.status === 'paid' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[10px] font-medium">
                          সম্পন্ন
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0 text-[10px] font-medium">
                          পেন্ডিং
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SolidCard>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPayouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Banknote className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">কোনো পেআউট নেই</p>
          </div>
        ) : (
          filteredPayouts.map((payout) => {
            const isRefund = payout.type === 'buyer_refund';
            return (
              <SolidCard
                key={payout.id}
                className="!p-0 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => setSelectedPayout(payout)}
              >
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`border-0 text-[10px] ${isRefund ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : 'bg-primary/10 text-primary'}`}>
                        {isRefund ? 'ফেরত' : 'পেআউট'}
                      </Badge>
                      {payout.status === 'paid' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[10px]">সম্পন্ন</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-0 text-[10px]">পেন্ডিং</Badge>
                      )}
                    </div>
                    <p className="text-lg font-bold text-foreground">৳{payout.amount.toLocaleString('en')}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{payout.recipient?.name || 'অজানা'}</p>
                  <p className="text-xs text-muted-foreground">
                    {payout.accountType} · {payout.accountNumber}
                  </p>
                </div>
              </SolidCard>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel: বিরোধ ম্যানেজমেন্ট
   ═══════════════════════════════════════════ */

interface DisputeDeal {
  id: string;
  title: string;
  amount: number;
  status: string;
  updatedAt: string;
  buyer: { id: string; name: string; email: string; phone: string } | null;
  seller: { id: string; name: string; email: string; phone: string } | null;
}

function DisputesPanel() {
  const [deals, setDeals] = useState<DisputeDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<DisputeDeal | null>(null);
  const [messages, setMessages] = useState<AdminChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const disputeChatScrollRef = useRef<HTMLDivElement>(null);
  const disputeNearBottomRef = useRef(true);

  const handleDisputeChatScroll = useCallback(() => {
    const el = disputeChatScrollRef.current;
    if (!el) return;
    disputeNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/disputes');
      if (res.ok) setDeals(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  /* Auto-poll every 5s */
  useEffect(() => {
    const interval = setInterval(fetchDeals, 5000);
    return () => clearInterval(interval);
  }, [fetchDeals]);

  /* Fetch chat when deal selected */
  useEffect(() => {
    if (!selectedDeal) return;
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/chat`);
        if (res.ok) setMessages(await res.json());
      } catch { /* ignore */ }
    };
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [selectedDeal]);

  /* No auto-scroll on incoming — only on admin send */

  const handleSend = async () => {
    if (!chatInput.trim() || !selectedDeal || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatInput }),
      });
      if (res.ok) {
        setChatInput('');
        const msgRes = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/chat`);
        if (msgRes.ok) {
          setMessages(await msgRes.json());
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const handleResolve = async (action: 'complete' | 'refund_buyer') => {
    if (!selectedDeal || resolving) return;
    setResolving(action);
    try {
      const res = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/resolve-dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(action === 'complete' ? 'ডিল সম্পন্ন করা হয়েছে' : 'ডিল বাতিল করা হয়েছে');
        setSelectedDeal(null);
        fetchDeals();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সমস্যা হয়েছে');
    } finally {
      setResolving(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatAmount = (n: number) => `৳${n.toLocaleString('en')}`;

  /* ── Chat View ── */
  if (selectedDeal) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSelectedDeal(null)}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{selectedDeal.title}</p>
            <p className="text-xs text-muted-foreground">
              {selectedDeal.buyer?.name} — {selectedDeal.seller?.name || 'N/A'} · {formatAmount(selectedDeal.amount)}
            </p>
          </div>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 text-[10px] font-medium">
            বিরোধ চলছে
          </Badge>
        </div>

        {/* Deal info card */}
        <SolidCard className="mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">ক্রেতা</p>
              <p className="font-semibold text-foreground">{selectedDeal.buyer?.name || 'N/A'}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{selectedDeal.buyer?.phone || ''}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">বিক্রেতা</p>
              <p className="font-semibold text-foreground">{selectedDeal.seller?.name || 'N/A'}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{selectedDeal.seller?.phone || ''}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">বিরোধ তৈরি: {formatDate(selectedDeal.updatedAt)}</span>
            <span className="text-sm font-bold text-foreground">{formatAmount(selectedDeal.amount)}</span>
          </div>
        </SolidCard>

        {/* Resolve Actions */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!!resolving}
                className="w-full h-11 gap-2 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {resolving === 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                সেলারকে পেমেন্ট
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>সেলারকে পেমেন্ট দিবেন?</AlertDialogTitle>
                <AlertDialogDescription>
                  ডিল &quot;সম্পন্ন&quot; হিসেবে চিহ্নিত হবে। সেলার পেআউট অনুরোধ করতে পারবেন।
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                <Button onClick={() => handleResolve('complete')} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                  হ্যাঁ, সম্পন্ন করুন
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!!resolving}
                variant="outline"
                className="w-full h-11 gap-2 rounded-xl text-sm font-bold border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                {resolving === 'refund_buyer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                ক্রেতাকে রিফান্ড
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>ক্রেতাকে রিফান্ড দিবেন?</AlertDialogTitle>
                <AlertDialogDescription>
                  ডিল &quot;বাতিল&quot; হিসেবে চিহ্নিত হবে। ক্রেতা ফেরতের অনুরোধ করতে পারবেন।
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                <Button onClick={() => handleResolve('refund_buyer')} className="gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl">
                  হ্যাঁ, বাতিল করুন
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Chat */}
        <SolidCard className="flex flex-col !p-0 overflow-hidden">
          <div ref={disputeChatScrollRef} onScroll={handleDisputeChatScroll} className="flex-1 min-h-[300px] max-h-[50vh] overflow-y-auto p-4 space-y-3 bg-muted/30" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">কোনো মেসেজ নেই</p>
              </div>
            )}
            {messages.map((msg) => <AdminChatBubble key={msg.id} msg={msg} />)}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/50 px-4 py-3 bg-card">
            <div className="flex items-center gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="মেসেজ লিখুন..."
                className="flex-1 h-10 rounded-xl text-sm"
              />
              <Button
                onClick={handleSend}
                disabled={!chatInput.trim() || sending}
                size="sm"
                className="h-10 rounded-xl px-4 gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                <span className="hidden sm:inline">পাঠান</span>
              </Button>
            </div>
          </div>
        </SolidCard>
      </div>
    );
  }

  /* ── List View ── */
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            বিরোধ ম্যানেজমেন্ট
          </h2>
          <p className="text-sm text-muted-foreground">বিরোধ চলমান ডিলসমূহ পর্যালোচনা ও রিজোলভ করুন</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDeals} className="gap-2 rounded-xl">
          <Loader2 className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : 'hidden'}`} />
          রিফ্রেশ
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SolidCard key={i}><div className="h-24 animate-pulse rounded-lg bg-muted" /></SolidCard>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <SolidCard className="text-center py-16">
          <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">কোনো বিরোধ নেই</p>
          <p className="text-xs text-muted-foreground/70 mt-1">ক্রেতা বিরোধ দায়ের করলে এখানে দেখা যাবে</p>
        </SolidCard>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <SolidCard className="!p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">ডিল</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">ক্রেতা</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">বিক্রেতা</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">পরিমাণ</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">তারিখ</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedDeal(deal)}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-foreground truncate max-w-[180px]">{deal.title}</p>
                        <p className="text-[10px] text-muted-foreground">DL-{deal.id.slice(-5)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{deal.buyer?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{deal.seller?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{formatAmount(deal.amount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(deal.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className="gap-1.5 rounded-lg text-xs font-medium" onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); }}>
                          দেখুন <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SolidCard>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden grid gap-3">
            {deals.map((deal) => (
              <SolidCard key={deal.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedDeal(deal)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{deal.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">DL-{deal.id.slice(-5)}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>ক্রেতা: {deal.buyer?.name || 'N/A'}</span>
                      <span>বিক্রেতা: {deal.seller?.name || 'N/A'}</span>
                    </div>
                    <p className="text-base font-bold text-foreground mt-2">{formatAmount(deal.amount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 text-[10px] font-medium">
                      <AlertTriangle className="h-3 w-3 mr-1" /> বিরোধ
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{formatDate(deal.updatedAt)}</span>
                  </div>
                </div>
              </SolidCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel: লাইভ চ্যাট — Admin Chat with Users
   ═══════════════════════════════════════════ */

interface CalledDeal {
  id: string;
  title: string;
  amount: number;
  status: string;
  adminCalledAt: string | null;
  buyer: { id: string; name: string; email: string; phone: string } | null;
  seller: { id: string; name: string; email: string; phone: string } | null;
}

interface AdminChatMsg {
  id: string;
  senderId: string;
  role: string | null;
  senderName: string | null;
  text: string;
  createdAt: string;
}

function AdminCallsPanel() {
  const [deals, setDeals] = useState<CalledDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<CalledDeal | null>(null);
  const [messages, setMessages] = useState<AdminChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const adminCallScrollRef = useRef<HTMLDivElement>(null);
  const adminCallNearBottomRef = useRef(true);

  const handleAdminCallScroll = useCallback(() => {
    const el = adminCallScrollRef.current;
    if (!el) return;
    adminCallNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/called-deals');
      if (res.ok) setDeals(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  /* Auto-poll for new admin calls every 5 seconds */
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDeals();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDeals]);

  /* Fetch chat messages when a deal is selected */
  useEffect(() => {
    if (!selectedDeal) return;
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/chat`);
        if (res.ok) setMessages(await res.json());
      } catch { /* ignore */ }
    };
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [selectedDeal]);

  /* No auto-scroll on incoming — only on admin send */

  const handleSend = async () => {
    if (!chatInput.trim() || !selectedDeal || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatInput }),
      });
      if (res.ok) {
        setChatInput('');
        const msgRes = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/chat`);
        if (msgRes.ok) {
          setMessages(await msgRes.json());
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatAmount = (n: number) => `৳${n.toLocaleString('en')}`;

  /* ── End Call Handler ── */
  const [endingCall, setEndingCall] = useState(false);

  const handleEndCall = async () => {
    if (!selectedDeal || endingCall) return;
    setEndingCall(true);
    try {
      const res = await fetch(`/api/admin/deals/${encodeURIComponent(selectedDeal.id)}/end-call`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('চ্যাট শেষ করা হয়েছে');
        setSelectedDeal(null);
        fetchDeals();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সমস্যা হয়েছে');
    } finally {
      setEndingCall(false);
    }
  };

  /* ── Chat View ── */
  if (selectedDeal) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Chat Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSelectedDeal(null)}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{selectedDeal.title}</p>
            <p className="text-xs text-muted-foreground">
              {selectedDeal.buyer?.name} — {selectedDeal.seller?.name || 'N/A'} · {formatAmount(selectedDeal.amount)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEndCall}
            disabled={endingCall}
            className="gap-1.5 rounded-xl text-xs font-medium border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            {endingCall ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">চ্যাট শেষ করুন</span>
          </Button>
        </div>

        {/* Messages */}
        <SolidCard className="flex flex-col !p-0 overflow-hidden">
          <div ref={adminCallScrollRef} onScroll={handleAdminCallScroll} className="flex-1 min-h-[400px] max-h-[60vh] overflow-y-auto p-4 space-y-3 bg-muted/30" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">কোনো মেসেজ নেই</p>
              </div>
            )}
            {messages.map((msg) => <AdminChatBubble key={msg.id} msg={msg} />)}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/50 px-4 py-3 bg-card">
            <div className="flex items-center gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="মেসেজ লিখুন..."
                className="flex-1 h-10 rounded-xl text-sm"
              />
              <Button
                onClick={handleSend}
                disabled={!chatInput.trim() || sending}
                size="sm"
                className="h-10 rounded-xl px-4 gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                <span className="hidden sm:inline">পাঠান</span>
              </Button>
            </div>
          </div>
        </SolidCard>
      </div>
    );
  }

  /* ── List View ── */
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-foreground">লাইভ চ্যাট</h2>
          <p className="text-sm text-muted-foreground">ইউজারদের ডাকা ডিলসমূহ</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDeals} className="gap-2 rounded-xl">
          <Loader2 className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : 'hidden'}`} />
          রিফ্রেশ
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SolidCard key={i}><div className="h-24 animate-pulse rounded-lg bg-muted" /></SolidCard>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <SolidCard className="text-center py-16">
          <Headphones className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">কোনো অ্যাডমিন কল নেই</p>
          <p className="text-xs text-muted-foreground/70 mt-1">ইউজাররা যখন অ্যাডমিন ডাকবে, এখানে দেখা যাবে</p>
        </SolidCard>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <SolidCard className="!p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">ডিল</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">ক্রেতা</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">বিক্রেতা</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">পরিমাণ</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">ডাকার সময়</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedDeal(deal)}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-foreground truncate max-w-[180px]">{deal.title}</p>
                        <p className="text-[10px] text-muted-foreground">DL-{deal.id.slice(-5)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{deal.buyer?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{deal.seller?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{formatAmount(deal.amount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{deal.adminCalledAt ? formatTime(deal.adminCalledAt) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className="gap-1.5 rounded-lg text-xs font-medium" onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); }}>
                          চ্যাট খুলুন <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SolidCard>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden grid gap-3">
            {deals.map((deal) => (
              <SolidCard key={deal.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedDeal(deal)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{deal.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">DL-{deal.id.slice(-5)}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>ক্রেতা: {deal.buyer?.name || 'N/A'}</span>
                      <span>বিক্রেতা: {deal.seller?.name || 'N/A'}</span>
                    </div>
                    <p className="text-base font-bold text-foreground mt-2">{formatAmount(deal.amount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[10px] font-medium">
                      <Headphones className="h-3 w-3 mr-1" /> কল
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {deal.adminCalledAt ? formatTime(deal.adminCalledAt) : ''}
                    </span>
                  </div>
                </div>
              </SolidCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Panel Router
   ═══════════════════════════════════════════ */

function AdminPanelContent({ panel }: { panel: AdminPanel }) {
  switch (panel) {
    case 'payment-verify':
      return <PaymentVerifyPanel />;
    case 'payouts':
      return <PayoutsPanel />;
    case 'payment-methods':
      return <PaymentMethodsPanel />;
    case 'fee-rules':
      return <FeeRulesPanel />;
    case 'contact-info':
      return <ContactInfoPanel />;
    case 'all-deals':
      return <AllDealsPanel />;
    case 'users':
      return <UsersPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'profile':
      return <AdminProfilePanel />;
    case 'contract':
      return <ContractPanel />;
    case 'blog':
      return <BlogPanel />;
    case 'admin-calls':
      return <AdminCallsPanel />;
    case 'disputes':
      return <DisputesPanel />;
    case 'email-settings':
      return <EmailSettingsPanel />;
    case 'two-factor':
      return <TwoFactorPanel />;
    case 'ai-prompt':
      return <AiPromptPanel />;
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════
   Admin Main (Exported)
   ═══════════════════════════════════════════ */

export function AdminMain() {
  const t = useT();
  const { adminPanel, user, setAdminPanel } = useAppStore();
  const { siteName } = useSiteSettings();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // ── Role-based permission guard ──
  const ALWAYS_ALLOWED = new Set<string>(['dashboard', 'profile']);
  const SUPPORT_PANELS = new Set<string>(['dashboard','profile','payment-verify','payouts','admin-calls','disputes','all-deals','contact-info','blog']);

  const hasPanelAccess = (panel: string): boolean => {
    if (!user || user.adminRole === 'super_admin') return true;
    if (user.adminRole === 'support') return SUPPORT_PANELS.has(panel);
    if (user.adminRole === 'staff') {
      const perms = user.permissions ?? [];
      return ALWAYS_ALLOWED.has(panel) || perms.includes(panel);
    }
    return true;
  };

  useEffect(() => {
    if (!hasPanelAccess(adminPanel)) {
      setAdminPanel('dashboard');
    }
  }, [user, adminPanel, setAdminPanel]);

  if (!mounted) return null;

  // Block rendering of unauthorized panels
  if (!hasPanelAccess(adminPanel)) {
      return (
        <div className="flex-1 p-4 sm:p-6 lg:px-6 lg:py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
              <ShieldX className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">অ্যাক্সেস নেই</h2>
            <p className="text-sm text-muted-foreground">এই প্যানেলে আপনার অ্যাক্সেস নেই। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
          </div>
        </div>
      );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:px-6 lg:py-8">
      {/* ── Top Bar ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="text-primary">{siteName}</span>
            <span className="text-muted-foreground font-normal text-base">
              — অ্যাডমিন প্যানেল
            </span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            এসক্রো ম্যানেজমেন্ট ড্যাশবোর্ড
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="নোটিফিকেশন"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
          </button>
          {/* Admin Avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
            {user?.name?.charAt(0) || 'অ'}
          </div>
        </div>
      </div>

      {/* ── Stats Cards (Dashboard only) ── */}
      {adminPanel === 'dashboard' && (
        <div className="mb-6">
          <DashboardStatsPanel />
        </div>
      )}

      {/* ── Panel Content ── */}
      <AdminPanelContent panel={adminPanel} />
    </div>
  );
}