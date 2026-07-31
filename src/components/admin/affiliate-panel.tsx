'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users, Wallet, Clock, TrendingUp, Save, Loader2, Copy, Check, ArrowDownToLine,
} from 'lucide-react';

function formatTaka(amount: number): string {
  return '\u09F3' + Math.round(amount).toLocaleString('en');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AdminAffiliatePanel() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [topAffiliates, setTopAffiliates] = useState<any[]>([]);
  const [recentEarnings, setRecentEarnings] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [commissionPercent, setCommissionPercent] = useState('30');
  const [savingPercent, setSavingPercent] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/affiliate');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data.stats);
      setTopAffiliates(data.topAffiliates);
      setRecentEarnings(data.recentEarnings);
      setPendingWithdrawals(data.pendingWithdrawals);
      setCommissionPercent(String(data.commissionPercent));
    } catch {
      toast.error('Error loading data');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSavePercent = async () => {
    setSavingPercent(true);
    try {
      const res = await fetch('/api/admin/affiliate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionPercent: Number(commissionPercent) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
    } catch (err) {
      toast.error((err as Error).message || 'Error');
    }
    setSavingPercent(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    { label: 'Active Affiliates', value: stats?.activeAffiliates?.toLocaleString('en') ?? '0', icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Total Distributed', value: stats ? formatTaka(stats.totalEarningsDistributed) : '\u09F30', icon: Wallet, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Pending Withdrawals', value: String(stats?.pendingWithdrawals ?? 0), icon: Clock, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Total Paid Out', value: stats ? formatTaka(stats.completedWithdrawalAmount) : '\u09F30', icon: TrendingUp, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t('adminNav.affiliate')}</h2>
          <p className="text-sm text-muted-foreground">Affiliate System Management</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-lg border border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg sm:text-xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Commission Setting */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg border border-border/50">
        <h3 className="text-base font-semibold text-foreground mb-3">Commission Setting</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Commission %</Label>
            <Input type="number" min={1} max={100} value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)} className="h-10" />
          </div>
          <Button onClick={handleSavePercent} disabled={savingPercent} className="h-10 gap-1.5">
            {savingPercent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Pending Withdrawals */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownToLine className="h-4 w-4 text-amber-500" />
          <h3 className="text-base font-semibold text-foreground">Pending Withdrawals ({pendingWithdrawals.length})</h3>
        </div>
        {pendingWithdrawals.length > 0 ? (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border/50 bg-muted/80">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">User</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Method</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Account</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {pendingWithdrawals.map((w: any) => (
                  <tr key={w.id} className="border-b border-border/30 hover:bg-accent/30 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground text-xs">{w.user?.name || '-'}</p>
                      <p className="text-xs text-muted-foreground">{w.user?.phone || ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">{formatTaka(w.amount)}</td>
                    <td className="px-3 py-2.5 text-xs uppercase">{w.accountType}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{w.accountNumber}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatDate(w.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending withdrawals</p>
        )}
      </div>

      {/* Top Affiliates */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg border border-border/50">
        <h3 className="text-base font-semibold text-foreground mb-3">Top Affiliates</h3>
        {topAffiliates.length > 0 ? (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border/50 bg-muted/80">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Code</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Referrals</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Earnings</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody>
                {topAffiliates.map((a: any) => (
                  <tr key={a.id} className="border-b border-border/30 hover:bg-accent/30 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground text-xs">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.referralCode ? (
                        <button onClick={() => handleCopyCode(a.referralCode)} className="flex items-center gap-1 text-xs font-mono text-primary hover:underline">
                          {copiedCode === a.referralCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {a.referralCode}
                        </button>
                      ) : <span className="text-xs text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">{a._count.referredUsers}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">{a._count.affiliateEarnings}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold">{formatTaka(a.affiliateBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No affiliates yet</p>
        )}
      </div>

      {/* Recent Earnings */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg border border-border/50">
        <h3 className="text-base font-semibold text-foreground mb-3">Recent Commissions</h3>
        {recentEarnings.length > 0 ? (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border/50 bg-muted/80">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Affiliate</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Referred</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Deal</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentEarnings.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/30 hover:bg-accent/30 last:border-0">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">{e.affiliate?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.referredUser?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">{e.deal?.title || '-'}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{formatTaka(e.amount)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No commissions yet</p>
        )}
      </div>
    </div>
  );
}
