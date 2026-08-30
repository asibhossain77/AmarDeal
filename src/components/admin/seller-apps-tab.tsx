'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  UserCheck, UserX, Users, Clock, Loader2,
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

interface SellerApp {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; phone: string; imageLink: string | null };
}

export function SellerAppsTab() {
  const t = useT();
  const [apps, setApps] = useState<SellerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
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

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const url = '/api/admin/seller-applications/' + id;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) {
        toast.success(t('admin.sellerApps.approveSuccess'));
        fetchApps();
      }
    } catch { /* ignore */ }
    setProcessing(null);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setProcessing(rejectId);
    try {
      const url = '/api/admin/seller-applications/' + rejectId;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: rejectReason || null }),
      });
      if (res.ok) {
        toast.success(t('admin.sellerApps.rejectSuccess'));
        setRejectId(null);
        setRejectReason('');
        fetchApps();
      }
    } catch { /* ignore */ }
    setProcessing(null);
  };

  const pendingCount = apps.filter((a) => a.status === 'pending').length;

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
      return <img src={imageLink} alt={name} className={imgCls} />;
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.businessName')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.contactEmail')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{t('admin.sellerApps.contactPhone')}</th>
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
                      <td className="px-4 py-3 font-medium text-foreground">{app.businessName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{app.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{app.phone}</td>
                      <td className="px-4 py-3 text-center"><AppStatusBadge status={app.status} /></td>
                      <td className="px-4 py-3 text-center">
                        {app.status === 'pending' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(app.id)}
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
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">{t('admin.sellerApps.businessName')}</span>
                    <p className="font-medium text-foreground mt-0.5">{app.businessName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('admin.sellerApps.contactPhone')}</span>
                    <p className="font-medium text-foreground mt-0.5">{app.phone}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('admin.sellerApps.contactEmail')}</span>
                    <p className="font-medium text-foreground mt-0.5">{app.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('admin.sellerApps.appliedAt')}</span>
                    <p className="font-medium text-foreground mt-0.5">{new Date(app.createdAt).toLocaleDateString('bn-BD')}</p>
                  </div>
                </div>
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
                      onClick={() => handleApprove(app.id)}
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
            <DialogDescription>{t('admin.sellerApps.rejectReason')}</DialogDescription>
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
    </motion.div>
  );
}
