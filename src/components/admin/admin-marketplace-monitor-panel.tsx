'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  Users, Store, Package, Flag, ShieldAlert, BadgeCheck, Clock,
  Activity, Loader2, Ban, FileWarning, History, UserCheck, PackageSearch, Star,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — Marketplace Monitoring panel.
   Overview statistics for sellers, listings and reports + a recent
   moderation-activity feed (from the append-only AdminAuditLog).
   Read-only — actions live in the Sellers / Products / Reports panels.
   ═══════════════════════════════════════════════════════════════ */

interface MonitorData {
  sellers: Record<string, number>;
  products: Record<string, number>;
  reports: Record<string, number>;
  recent: {
    id: string; adminName: string | null; action: string;
    targetType: string; targetId: string | null; details: string | null;
    createdAt: string;
  }[];
}

interface Tile { icon: React.ElementType; label: string; value: number; cls: string; panel?: string }

export function AdminMarketplaceMonitorPanel() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonitorData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketplace-monitor');
      const json = await res.json();
      if (res.ok) setData(json);
      else toast.error(json.error || t('common.error'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const sellerTiles: Tile[] = [
    { icon: Users, label: t('adminMkt.statTotalSellers'), value: data?.sellers.totalSellers || 0, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
    { icon: BadgeCheck, label: t('adminMkt.statVerifiedBusiness'), value: data?.sellers.verifiedBusiness || 0, cls: 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400' },
    { icon: Clock, label: t('adminMkt.statPendingVerification'), value: data?.sellers.pendingVerification || 0, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
    { icon: Ban, label: t('adminMkt.statSuspended'), value: data?.sellers.suspendedSellers || 0, cls: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400' },
    { icon: ShieldAlert, label: t('adminMkt.statRestricted'), value: data?.sellers.restrictedSellers || 0, cls: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' },
    { icon: UserCheck, label: t('adminMkt.statNewSellers30d'), value: data?.sellers.newSellers30d || 0, cls: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400' },
  ];
  const productTiles: Tile[] = [
    { icon: Package, label: t('adminMkt.statTotalProducts'), value: data?.products.totalProducts || 0, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
    { icon: Store, label: t('adminMkt.statActiveProducts'), value: data?.products.activeProducts || 0, cls: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400' },
    { icon: Clock, label: t('adminMkt.statPendingProducts'), value: data?.products.pendingProducts || 0, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
    { icon: FileWarning, label: t('adminMkt.statRejectedProducts'), value: data?.products.rejectedProducts || 0, cls: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' },
    { icon: PackageSearch, label: t('adminMkt.statUnpublished'), value: data?.products.unpublishedProducts || 0, cls: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400' },
    { icon: Ban, label: t('adminMkt.statRemoved'), value: data?.products.removedProducts || 0, cls: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400' },
  ];
  const reportTiles: Tile[] = [
    { icon: Flag, label: t('adminMkt.statOpenReports'), value: data?.reports.openReports || 0, cls: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
    { icon: Activity, label: t('adminMkt.statUnderReview'), value: data?.reports.underReviewReports || 0, cls: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400' },
    { icon: BadgeCheck, label: t('adminMkt.statResolved'), value: data?.reports.resolvedReports || 0, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
    { icon: Star, label: t('adminMkt.statOpenReviewReports'), value: data?.reports.openReviewReports || 0, cls: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
  ];

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const TileGrid = ({ tiles }: { tiles: Tile[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map((s) => (
        <div key={s.label} className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/60 p-3.5">
          <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.cls}`}>
            <s.icon className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-bold text-foreground tabular-nums">{s.value}</p>
          <p className="text-[11px] font-medium text-muted-foreground leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{t('adminMkt.monitorTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('adminMkt.monitorDesc')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Sellers */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2.5">{t('adminMkt.sectionSellers')}</h3>
            <TileGrid tiles={sellerTiles} />
          </section>

          {/* Products */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2.5">{t('adminMkt.sectionProducts')}</h3>
            <TileGrid tiles={productTiles} />
          </section>

          {/* Reports */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2.5">{t('adminMkt.sectionReports')}</h3>
            <TileGrid tiles={reportTiles} />
          </section>

          {/* Recent moderation activity */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2.5">{t('adminMkt.sectionRecent')}</h3>
            {(data?.recent?.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-6 text-center">
                {t('adminMkt.noRecentActivity')}
              </p>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/60 divide-y divide-border/40">
                {data?.recent.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <History className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground">
                        <span className="font-mono font-semibold text-primary">{log.action}</span>
                        {' · '}{log.adminName || 'Admin'}
                        {' · '}<span className="text-muted-foreground">{log.targetType}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">{fmtDate(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
