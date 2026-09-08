'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  UserCheck, UserX, Users, Clock, Loader2, Ban, RotateCcw, MessageCircle, CalendarDays, Copy, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n';
import { SolidCard } from './marketplace-panel';
import { cdnUrl } from '@/lib/cdn-url';

interface SellerApp {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  whatsappNumber: string | null;
  verificationCode: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; phone: string; imageLink: string | null; isSeller: boolean; whatsappNumber: string | null };
}

export function SellerAppsTab() {
  const t = useT();
  const [apps, setApps] = useState<SellerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/seller-applications');
      if (res.ok) {
        const data = await res.json();
        setApps(data.applications || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleAction = async (id: string, status: string, reason?: string) => {
    setProcessing(id);
    try {
      const url = '/api/admin/seller-applications/' + id;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason: reason || null }),
      });
      if (res.ok) {
        if (status === 'approved') toast.success(t('admin.sellerApps.approveSuccess'));
        else if (status === 'rejected') toast.success(t('admin.sellerApps.rejectSuccess'));
        else if (status === 'disabled') toast.success(t('admin.sellerApps.disableSuccess'));
        else if (status === 'enabled') toast.success(t('admin.sellerApps.enableSuccess'));
        fetchApps();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed');
      }
    } catch { /* ignore */ }
    setProcessing(null);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    await handleAction(rejectId, 'rejected', rejectReason);
    setRejectId(null);
    setRejectReason('');
  };

  const handleDisable = async () => {
    if (!disableId) return;
    await handleAction(disableId, 'disabled');
    setDisableId(null);
  };

  const pendingCount = apps.filter((a) => a.status === 'pending').length;

  function waLink(number: string | null): string | null {
    if (!number) return null;
    const digits = number.replace(/[^0-9]/g, '');
    if (!digits) return null;
    if (digits.startsWith('880') && digits.length >= 12) return `https://wa.me/${digits}`;
    if (digits.startsWith('01') && digits.length === 11) return `https://wa.me/88${digits}`;
    return null;
  }

  function WhatsAppCell({ number }: { number: string | null }) {
    const link = waLink(number);
    if (!number) return <span className="text-muted-foreground">-</span>;
    return (
      <a
        href={link || `https://wa.me/${number.replace(/[^0-9]/g, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-[#25D366] transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
        {number}
      </a>
    );
  }

  function waDigits(app: SellerApp): string {
    const digits = (app.whatsappNumber || app.user.whatsappNumber || '').replace(/[^0-9]/g, '');
    if (digits.startsWith('880')) return digits;
    if (digits.startsWith('01') && digits.length === 11) return '88' + digits;
    return digits;
  }

  function waSendHref(app: SellerApp): string {
    const msg = `আপনার Midman সেলার ভেরিফিকেশন কোড: ${app.verificationCode || ''}`;
    return `https://wa.me/${waDigits(app)}?text=${encodeURIComponent(msg)}`;
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t('seller.codeCopied'));
    } catch { /* clipboard unavailable */ }
  }

  function VerificationCodeCell({ app }: { app: SellerApp }) {
    if (app.status !== 'pending' || !app.verificationCode) {
      return <span className="text-muted-foreground">-</span>;
    }
    return (
      <div className="inline-flex items-center gap-1.5">
        <code className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-sm font-bold tracking-[0.2em] text-amber-700 dark:text-amber-400" dir="ltr">{app.verificationCode}</code>
        <button
          onClick={() => copyCode(app.verificationCode!)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={t('seller.codeCopy')}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <a
          href={waSendHref(app)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md p-1 text-[#25D366] transition-colors hover:bg-[#25D366]/10"
          title={t('admin.sellerApps.sendCode')}
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      </div>
    );
  }

  function AppStatusBadge({ status }: { status: string }) {
    if (status === 'pending') return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium gap-1">
        <Clock className="h-3 w-3" /> {t('admin.sellerApps.pending')}
      </Badge>
    );
    if (status === 'approved') return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium gap-1">
        <UserCheck className="h-3 w-3" /> {t('admin.sellerApps.approved')}
      </Badge>
    );
    if (status === 'disabled') return (
      <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400 border-0 font-medium gap-1">
        <Ban className="h-3 w-3" /> {t('admin.sellerApps.disabled')}
      </Badge>
    );
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium gap-1">
        <UserX className="h-3 w-3" /> {t('admin.sellerApps.rejected')}
      </Badge>
    );
  }

  function UserAvatar({ name, imageLink, size = 'sm' }: { name: string; imageLink: string | null; size?: 'sm' | 'lg' }) {
    const cls = size === 'lg'
      ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary'
      : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary';
    if (imageLink) {
      const imgCls = size === 'lg' ? 'h-10 w-10 rounded-full object-cover' : 'h-8 w-8 rounded-full object-cover';
      return <img src={cdnUrl(imageLink) || ''} alt={name} className={imgCls} />;
    }
    return <div className={cls}>{name.charAt(0)}</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <SolidCard className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          {t('admin.sellerApps.tabApplications')}
        </h3>
        {pendingCount > 0 && (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium">
            {pendingCount} {t('admin.sellerApps.pendingCount')}
          </Badge>
        )}
      </SolidCard>

      {apps.length === 0 ? (
        <SolidCard className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{t('admin.sellerApps.noApplications')}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{t('admin.sellerApps.noApplicationsDesc')}</p>
        </SolidCard>
      ) : (
        <>
          {/* Desktop Table */}
          <SolidCard className="!p-0 overflow-hidden hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.applicant')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.whatsappNumber')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.code')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.appliedAt')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.status')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => (
                    <tr key={app.id} className="border-b border-border/30 last:border-0 transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={app.user.name} imageLink={app.user.imageLink} />
                          <div>
                            <p className="font-medium text-foreground">{app.user.name}</p>
                            <p className="text-xs text-muted-foreground">{app.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><WhatsAppCell number={app.whatsappNumber || app.user.whatsappNumber} /></td>
                      <td className="px-4 py-3"><VerificationCodeCell app={app} /></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(app.createdAt).toLocaleDateString('bn-BD')}</td>
                      <td className="px-4 py-3 text-center"><AppStatusBadge status={app.status} /></td>
                      <td className="px-4 py-3 text-center">
                        {app.status === 'pending' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleAction(app.id, 'approved')}
                              disabled={processing === app.id}
                              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {processing === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                              {t('admin.sellerApps.approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setRejectId(app.id); setRejectReason(''); }}
                              disabled={processing === app.id}
                              className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10"
                            >
                              <UserX className="h-3 w-3" />
                              {t('admin.sellerApps.reject')}
                            </Button>
                          </div>
                        ) : app.status === 'approved' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDisableId(app.id)}
                            disabled={processing === app.id}
                            className="h-8 gap-1 text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-500/20 dark:hover:bg-orange-500/10"
                          >
                            <Ban className="h-3 w-3" />
                            {t('admin.sellerApps.disable')}
                          </Button>
                        ) : app.status === 'disabled' ? (
                          <Button
                            size="sm"
                            onClick={() => handleAction(app.id, 'enabled')}
                            disabled={processing === app.id}
                            className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {processing === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            {t('admin.sellerApps.enable')}
                          </Button>
                        ) : app.rejectionReason ? (
                          <span className="text-xs text-red-500" title={app.rejectionReason}>{t('admin.sellerApps.rejectionReason')}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SolidCard>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {apps.map((app) => (
              <SolidCard key={app.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar name={app.user.name} imageLink={app.user.imageLink} size="lg" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{app.user.name}</p>
                      <p className="text-xs text-muted-foreground">{app.user.email}</p>
                    </div>
                  </div>
                  <AppStatusBadge status={app.status} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#25D366]/5 border border-[#25D366]/15 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
                      <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">{t('admin.sellerApps.whatsappNumber')}</p>
                      <WhatsAppCell number={app.whatsappNumber || app.user.whatsappNumber} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(app.createdAt).toLocaleDateString('bn-BD')}
                  </div>
                </div>
                {app.status === 'pending' && app.verificationCode && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-dashed border-amber-400/50 bg-amber-500/5 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <KeyRound className="h-3 w-3" />
                        {t('admin.sellerApps.code')}
                      </p>
                      <p className="font-mono text-xl font-bold tracking-[0.25em] text-foreground" dir="ltr">{app.verificationCode}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyCode(app.verificationCode!)}
                        disabled={processing === app.id}
                        className="h-8 w-8 p-0"
                        title={t('seller.codeCopy')}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <a href={waSendHref(app)} target="_blank" rel="noopener noreferrer">
                        <Button
                          size="sm"
                          disabled={processing === app.id}
                          className="h-8 gap-1.5 bg-[#25D366] hover:bg-[#1fb857] text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {t('admin.sellerApps.sendCode')}
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
                {app.status === 'rejected' && app.rejectionReason && (
                  <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2.5 text-xs">
                    <span className="font-medium text-red-600 dark:text-red-400">{t('admin.sellerApps.rejectionReason')}:</span>{' '}
                    {app.rejectionReason}
                  </div>
                )}
                {app.status === 'pending' && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleAction(app.id, 'approved')}
                      disabled={processing === app.id}
                      className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {processing === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {t('admin.sellerApps.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRejectId(app.id); setRejectReason(''); }}
                      disabled={processing === app.id}
                      className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10"
                    >
                      <UserX className="h-3.5 w-3.5" />
                      {t('admin.sellerApps.reject')}
                    </Button>
                  </div>
                )}
                {app.status === 'approved' && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDisableId(app.id)}
                      disabled={processing === app.id}
                      className="w-full gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-500/20 dark:hover:bg-orange-500/10"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {t('admin.sellerApps.disable')}
                    </Button>
                  </div>
                )}
                {app.status === 'disabled' && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleAction(app.id, 'enabled')}
                      disabled={processing === app.id}
                      className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {processing === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      {t('admin.sellerApps.enable')}
                    </Button>
                  </div>
                )}
              </SolidCard>
            ))}
          </div>
        </>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) setRejectId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              {t('admin.sellerApps.rejectConfirm')}
            </DialogTitle>
            <DialogDescription>{t('admin.sellerApps.rejectReasonLabel')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('admin.sellerApps.rejectReason')}</Label>
              <Textarea
                placeholder={t('admin.sellerApps.rejectReasonPh')}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRejectId(null)}>{t('admin.marketplace.cancel')}</Button>
            <Button onClick={handleReject} disabled={processing === rejectId} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              {processing === rejectId && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('admin.sellerApps.reject')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Confirm Dialog */}
      <Dialog open={!!disableId} onOpenChange={(open) => { if (!open) setDisableId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-orange-500" />
              {t('admin.sellerApps.disableConfirm')}
            </DialogTitle>
            <DialogDescription>{t('admin.sellerApps.disableDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDisableId(null)}>{t('admin.marketplace.cancel')}</Button>
            <Button onClick={handleDisable} disabled={processing === disableId} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
              {processing === disableId && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('admin.sellerApps.disable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
