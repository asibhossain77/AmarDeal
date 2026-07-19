'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n';

const emptySubscribe = () => () => {};

interface FeeRule {
  id: number;
  minimum_amount: number;
  maximum_amount: number;
  fee: number;
  is_active: boolean;
}

function formatRange(min: number, max: number, t: (key: string) => string): string {
  const minStr = `৳${min.toLocaleString('en')}`;
  if (max === 0) return `${minStr} — ${t('fee.unlimited')}`;
  return `৳${min.toLocaleString('en')} — ৳${max.toLocaleString('en')}`;
}

export function FeeStructure() {
  const t = useT();
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const setView = useAppStore((s) => s.setView);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/fee-structure');
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchRules();
    const interval = setInterval(fetchRules, 30000);
    return () => clearInterval(interval);
  }, [mounted, fetchRules]);

  if (!mounted) {
    return (
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted mx-auto mb-4" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted mx-auto mb-12" />
          <div className="rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl shadow-gray-300/50 dark:shadow-none overflow-hidden">
            <div className="h-12 bg-primary/20 animate-pulse" />
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="fees" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-4 border-0 bg-primary/10 text-primary font-semibold px-3 py-1">
            {t('fee.badge')}
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {t('fee.ourFee')}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('fee.subtitle')}
          </p>
        </div>

        {/* Fee Table Card */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl shadow-gray-300/50 dark:shadow-none overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-6 py-4 text-left text-sm font-bold">{t('fee.limitColumn')}</th>
                  <th className="px-6 py-4 text-right text-sm font-bold">{t('fee.ourFee')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-6 py-4"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-16 animate-pulse rounded bg-muted ml-auto" /></td>
                    </tr>
                  ))
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-muted-foreground">
                      {t('fee.noRules')}
                    </td>
                  </tr>
                ) : (
                  rules.map((rule, index) => (
                    <tr
                      key={rule.id}
                      className={`border-b border-border/40 transition-colors hover:bg-muted/30 ${
                        index % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-muted/10'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-foreground">
                          {formatRange(rule.minimum_amount, rule.maximum_amount, t)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge className="border-0 bg-primary/10 text-primary font-bold text-sm px-3 py-1">
                          ৳{rule.fee.toLocaleString('en')}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden p-4 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/60" />
              ))
            ) : rules.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                {t('fee.noRules')}
              </p>
            ) : (
              rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between rounded-2xl p-4 ${
                    index % 2 === 0
                      ? 'bg-white dark:bg-zinc-900 border border-border/40'
                      : 'bg-muted/10 border border-border/20'
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {formatRange(rule.minimum_amount, rule.maximum_amount, t)}
                  </span>
                  <Badge className="border-0 bg-primary/10 text-primary font-bold text-sm px-3 py-1">
                    ৳{rule.fee.toLocaleString('en')}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-10 text-center">
          <Button
            onClick={() => setView('auth')}
            size="lg"
            className="gap-2 rounded-xl font-bold shadow-lg shadow-primary/25 active:scale-[0.97] transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 px-8"
          >
            {t('fee.startDeal')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}