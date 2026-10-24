'use client';

/**
 * Admin Order Audit Panel — Phase 6.
 * Read-only audit trail of every sensitive admin decision
 * (cancellations, refunds, disputes, order actions).
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Loader2, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface AuditRow {
  id: string;
  adminId: string;
  adminName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  orderId: string | null;
  details: string | null;
  createdAt: string;
}

const TARGET_TYPES = ['all', 'refund_request', 'cancellation_request', 'dispute', 'order'] as const;

export function AdminOrderAuditPanel() {
  const t = useT();
  const [targetType, setTargetType] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState('');

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: '150' });
    if (targetType !== 'all') p.set('targetType', targetType);
    if (actionFilter.trim()) p.set('action', actionFilter.trim());
    return p.toString();
  }, [targetType, actionFilter]);

  const { data, isLoading } = useQuery<{ logs: AuditRow[] }>({
    queryKey: ['admin-order-audit', params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/order-audit?${params}`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    refetchInterval: 45000,
  });

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <ScrollText className="h-5 w-5 text-primary" />
            {t('adminNav.orderAudit')}
          </h2>
          <p className="text-[12px] text-muted-foreground">{t('adminProt.auditBy')} · {t('adminProt.time')}</p>
        </div>
        <div className="w-full sm:w-64">
          <Input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="refund_approve…" className="h-10 rounded-xl" dir="ltr" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TARGET_TYPES.map((tt) => (
          <button
            key={tt}
            onClick={() => setTargetType(tt)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
              targetType === tt ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/30',
            )}
          >
            {tt === 'all' ? t('adminProt.all') : tt}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="mt-2 text-sm">{t('adminProt.noData')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <div className="divide-y divide-border/40">
            {logs.map((log) => {
              let details = log.details ?? '';
              try {
                details = log.details ? JSON.stringify(JSON.parse(log.details)) : '';
              } catch { /* raw */ }
              return (
                <div key={log.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 bg-white p-3.5 text-[12px] dark:bg-zinc-900">
                  <span className="w-36 shrink-0 text-muted-foreground" dir="ltr">
                    {new Date(log.createdAt).toLocaleString('en-GB', { hour12: true })}
                  </span>
                  <span className="w-32 shrink-0 truncate font-semibold text-foreground">{log.adminName || log.adminId.slice(-6)}</span>
                  <span className="w-44 shrink-0 truncate rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{log.action}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" dir="ltr">
                    {log.targetType}{log.orderId ? ` · order ${log.orderId.slice(-8)}` : ''}{details ? ` · ${details.slice(0, 120)}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
