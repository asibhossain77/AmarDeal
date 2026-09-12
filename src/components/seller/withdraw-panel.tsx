'use client';

/**
 * Seller Withdraw Panel — pool-based balance withdrawal.
 * Balance = Σ completed deal amounts (fee is buyer-side, nothing deducted)
 *          − legacy per-deal payouts − previous/pending withdrawals.
 * Amount is computed SERVER-SIDE; the client only picks an amount + account.
 */

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import {
  Banknote, Wallet, CheckCircle2, Clock, XCircle, Plus, Wallet2,
  Check, ChevronDown, ShieldCheck,
} from 'lucide-react';

const PARROT_GREEN = '#65A30D';

const GLASS = 'relative rounded-2xl border !border-white/60 !bg-white/40 p-3.5 sm:p-5 shadow-xl !backdrop-blur-xl dark:!border-zinc-800/50 dark:!bg-zinc-900/50 dark:!backdrop-blur-xl';

const ACCOUNT_TYPES = [
  { id: 'bkash', label: 'bKash', color: '#E2136E' },
  { id: 'nagad', label: 'Nagad', color: '#F6921E' },
  { id: 'rocket', label: 'Rocket', color: '#8C3494' },
  { id: 'bank', label: 'Bank', color: '#0033A0' },
];

interface Balance {
  totalEarnings: number;
  legacyPayouts: number;
  withdrawnPaid: number;
  pendingWithdrawals: number;
  available: number;
  completedDeals: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

interface SavedAccount {
  id: string;
  accountType: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
}

function fmtTaka(n: number) { return '৳' + Math.round(n).toLocaleString('en'); }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function typeMeta(id: string) {
  return ACCOUNT_TYPES.find((a) => a.id === id) || { label: id, color: '#6B7280' };
}

function StatusBadge({ status, t }: { status: string; t: (k: any) => string }) {
  const map: Record<string, { cls: string; key: string; icon: React.ReactNode }> = {
    pending: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', key: 'withdraw.statusPending', icon: <Clock className="h-3 w-3" /> },
    approved: { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400', key: 'withdraw.statusApproved', icon: <ShieldCheck className="h-3 w-3" /> },
    completed: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', key: 'withdraw.statusCompleted', icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400', key: 'withdraw.statusRejected', icon: <XCircle className="h-3 w-3" /> },
  };
  const m = map[status] || { cls: 'bg-muted text-muted-foreground', key: '', icon: null };
  return (
    <Badge className={`${m.cls} border-0 font-medium text-[11px] gap-1`}>
      {m.icon}{m.key ? t(m.key) : status}
    </Badge>
  );
}

export function WithdrawPanel() {
  const t = useT();
  const qc = useQueryClient();

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountType: 'bkash', accountName: '', accountNumber: '' });
  const [addingAccount, setAddingAccount] = useState(false);

  /* ── Balance + history ── */
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['seller-withdrawals'],
    queryFn: async () => {
      const r = await fetch('/api/user/seller-withdrawals');
      if (!r.ok) throw new Error('failed');
      return r.json() as Promise<{ balance: Balance; withdrawals: Withdrawal[] }>;
    },
    staleTime: 10_000,
  });

  /* ── Saved accounts (PayoutAccount — now backed by a real table) ── */
  const { data: accounts = [] } = useQuery<SavedAccount[]>({
    queryKey: ['payout-accounts'],
    queryFn: async () => {
      const r = await fetch('/api/user/payout-accounts');
      if (!r.ok) return [];
      const d = await r.json();
      return d.accounts || [];
    },
    staleTime: 10_000,
  });

  // Auto-select default/first account
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId)) {
      const def = accounts.find((a) => a.isDefault) || accounts[0];
      setSelectedAccountId(def.id);
    }
  }, [accounts, selectedAccountId]);

  const balance = data?.balance;
  const withdrawals = data?.withdrawals ?? [];
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;
  const hasActiveWd = withdrawals.some((w) => w.status === 'pending' || w.status === 'approved');

  const submitWithdraw = async () => {
    if (!selectedAccount) { toast.error(t('withdraw.selectAccountFirst')); return; }
    const num = Number(amount);
    if (!num || num <= 0) { toast.error(t('withdraw.invalidAmount')); return; }
    if (balance && num > balance.available) { toast.error(t('withdraw.insufficient')); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/user/seller-withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: num,
          accountType: selectedAccount.accountType,
          accountNumber: selectedAccount.accountNumber,
          accountName: selectedAccount.accountName,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t('withdraw.submitFailed'));
      toast.success(d.message || t('withdraw.submitSuccess'));
      setAmount('');
      qc.invalidateQueries({ queryKey: ['seller-withdrawals'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const addAccount = async () => {
    if (!newAccount.accountName.trim() || !newAccount.accountNumber.trim()) {
      toast.error(t('withdraw.accountFieldsRequired'));
      return;
    }
    setAddingAccount(true);
    try {
      const r = await fetch('/api/user/payout-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAccount, accountName: newAccount.accountName.trim(), accountNumber: newAccount.accountNumber.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t('withdraw.accountAddFailed'));
      toast.success(t('withdraw.accountAdded'));
      setShowAddAccount(false);
      setNewAccount({ accountType: 'bkash', accountName: '', accountNumber: '' });
      qc.invalidateQueries({ queryKey: ['payout-accounts'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAddingAccount(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><LoadingAnimation size="lg" /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl" style={{ backgroundColor: PARROT_GREEN }}>
            <Banknote className="h-5 w-5 text-white" />
          </div>
          {t('withdraw.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('withdraw.subtitle')}</p>
      </div>

      {/* Balance card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className={GLASS + ' overflow-hidden'}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('withdraw.availableBalance')}</p>
              <p className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                {fmtTaka(balance?.available ?? 0)}
              </p>
            </div>
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: PARROT_GREEN + '1A' }}>
              <Wallet className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: PARROT_GREEN }} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t('withdraw.totalEarnings')}</p>
              <p className="text-sm sm:text-base font-bold text-foreground">{fmtTaka(balance?.totalEarnings ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t('withdraw.completedDeals')}</p>
              <p className="text-sm sm:text-base font-bold text-foreground">{balance?.completedDeals ?? 0}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 col-span-2 sm:col-span-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t('withdraw.inProcessing')}</p>
              <p className="text-sm sm:text-base font-bold text-foreground">{fmtTaka(balance?.pendingWithdrawals ?? 0)}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">{t('withdraw.balanceNote')}</p>
        </div>
      </motion.div>

      {/* Withdraw form */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className={GLASS + ' space-y-4'}>
          <p className="font-bold text-foreground">{t('withdraw.requestTitle')}</p>

          {hasActiveWd && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t('withdraw.activeExists')}</p>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t('withdraw.amount')}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('withdraw.amountPlaceholder')}
                className="h-11 text-base font-semibold"
                disabled={hasActiveWd || (balance?.available ?? 0) <= 0}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 font-semibold"
                disabled={hasActiveWd || !balance || balance.available <= 0}
                onClick={() => setAmount(String(Math.floor(balance!.available)))}
              >
                {t('withdraw.withdrawAll')}
              </Button>
            </div>
            {balance && balance.available > 0 && balance.available < 100 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">{t('withdraw.belowMinimumHint')}</p>
            )}
          </div>

          {/* Saved accounts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">{t('withdraw.savedAccounts')}</Label>
              <button
                type="button"
                onClick={() => setShowAddAccount((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{ color: PARROT_GREEN }}
              >
                <Plus className="h-3.5 w-3.5" />{t('withdraw.addAccount')}
              </button>
            </div>

            {accounts.length === 0 && !showAddAccount && (
              <button
                type="button"
                onClick={() => setShowAddAccount(true)}
                className="w-full rounded-xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                {t('withdraw.noAccounts')}
              </button>
            )}

            <div className="space-y-2">
              {accounts.map((acc) => {
                const meta = typeMeta(acc.accountType);
                const active = selectedAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    disabled={hasActiveWd}
                    className={'w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all disabled:opacity-60 ' + (active ? 'border-transparent ring-2 shadow-md' : 'border-border/60 hover:bg-accent/40')}
                    style={active ? { boxShadow: `0 0 0 2px ${meta.color}66` } : undefined}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-bold" style={{ backgroundColor: meta.color }}>
                      {meta.label.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        {meta.label}
                        {acc.isDefault && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{t('withdraw.defaultTag')}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{acc.accountNumber} · {acc.accountName}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0" style={{ color: meta.color }} />}
                  </button>
                );
              })}
            </div>

            {/* Add account inline form */}
            {showAddAccount && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ACCOUNT_TYPES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setNewAccount((p) => ({ ...p, accountType: a.id }))}
                      className={'rounded-lg border px-2 py-2 text-xs font-semibold transition-all ' + (newAccount.accountType === a.id ? 'border-transparent text-white shadow-md' : 'border-border/60 text-muted-foreground hover:bg-accent/40')}
                      style={newAccount.accountType === a.id ? { backgroundColor: a.color } : undefined}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t('withdraw.accountNumber')}</Label>
                    <Input value={newAccount.accountNumber} onChange={(e) => setNewAccount((p) => ({ ...p, accountNumber: e.target.value }))} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t('withdraw.accountName')}</Label>
                    <Input value={newAccount.accountName} onChange={(e) => setNewAccount((p) => ({ ...p, accountName: e.target.value }))} className="h-10" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-9" disabled={addingAccount} onClick={addAccount} style={{ backgroundColor: PARROT_GREEN, color: '#fff' }}>
                    {addingAccount ? <LoadingAnimation size="sm" /> : <><Check className="h-3.5 w-3.5" />{t('withdraw.saveAccount')}</>}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9" onClick={() => setShowAddAccount(false)}>{t('withdraw.cancel')}</Button>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            className="w-full h-12 text-base font-bold rounded-xl"
            style={{ backgroundColor: PARROT_GREEN, color: '#fff' }}
            disabled={submitting || hasActiveWd || !selectedAccount || (balance?.available ?? 0) <= 0}
            onClick={submitWithdraw}
          >
            {submitting ? <LoadingAnimation size="sm" /> : <><Wallet2 className="h-5 w-5" />{t('withdraw.submitBtn')}</>}
          </Button>
        </div>
      </motion.div>

      {/* History */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className={GLASS + ' space-y-3'}>
          <p className="font-bold text-foreground">{t('withdraw.historyTitle')}</p>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('withdraw.historyEmpty')}</p>
          ) : (
            <div className="space-y-2.5">
              {withdrawals.map((w) => {
                const meta = typeMeta(w.accountType);
                return (
                  <div key={w.id} className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-[9px] font-bold" style={{ backgroundColor: meta.color }}>
                          {meta.label.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-bold text-foreground">{fmtTaka(w.amount)}</p>
                      </div>
                      <StatusBadge status={w.status} t={t} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{meta.label} · <span className="font-mono">{w.accountNumber}</span> · {w.accountName}</span>
                      <span className="ml-auto">{fmtDate(w.createdAt)}</span>
                    </div>
                    {w.status === 'rejected' && w.adminNote && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">{t('withdraw.rejectNote')}: {w.adminNote}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
