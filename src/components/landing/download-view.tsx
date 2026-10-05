'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Package, Loader2, FileDown, ShieldCheck, Clock, LogIn,
  ShoppingCart, Download, FileText, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { PageWrapper } from './page-wrapper';
import { Footer } from './footer';

interface DownloadInfo {
  id: string;
  title: string;
  price: number;
  isFree: boolean;
  hasFile: boolean;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function DownloadView() {
  const t = useT();
  const downloadProductId = useAppStore((s) => s.downloadProductId);
  const user = useAppStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);
  const setDownloadProductId = useAppStore((s) => s.setDownloadProductId);

  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [dealStatus, setDealStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);
  const autoTriggered = useRef(false);

  const load = () => {
    if (!downloadProductId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/download/${downloadProductId}/info`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.product) {
          setInfo(d.product);
          setEntitled(!!d.entitled);
          setReason(d.reason ?? null);
          setDealStatus(d.dealStatus ?? null);
        } else {
          setInfo(null);
        }
      })
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [downloadProductId, user?.id]);

  // Auto-start the download once entitled info is loaded
  useEffect(() => {
    if (!entitled || !downloadProductId || autoTriggered.current) return;
    autoTriggered.current = true;
    const timer = setTimeout(() => {
      const a = document.createElement('a');
      a.href = `/api/download/${downloadProductId}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setAutoStarted(true);
    }, 700);
    return () => clearTimeout(timer);
  }, [entitled, downloadProductId]);

  const manualDownload = () => {
    if (!downloadProductId) return;
    const a = document.createElement('a');
    a.href = `/api/download/${downloadProductId}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(t('download.startedAgain'));
  };

  const claimFree = async () => {
    if (!downloadProductId) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/products/${downloadProductId}/claim`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('download.claimSuccess'));
        setAutoTriggeredFalse();
        load();
      } else if (res.status === 401) {
        toast.error(t('download.loginRequired'));
        setView('auth');
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setClaiming(false);
    }
  };

  // Allow re-triggering the auto download after a fresh claim
  const setAutoTriggeredFalse = () => { autoTriggered.current = false; };

  const goBack = () => {
    setDownloadProductId(null);
    setView('page-marketplace');
  };

  const openProduct = () => {
    if (!downloadProductId) return;
    const store = useAppStore.getState();
    store.setProductDetailId(downloadProductId);
    setDownloadProductId(null);
    store.setView('page-product');
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </PageWrapper>
    );
  }

  if (!info) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-muted-foreground">{t('download.notFound')}</p>
          <Button variant="outline" onClick={goBack} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" />{t('sellerProfile.backToMarketplace')}
          </Button>
        </div>
        <Footer />
      </PageWrapper>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 lg:px-8">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('sellerProfile.backToMarketplace')}
        </button>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pb-16 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm"
        >
          {/* Header */}
          <div className="border-b border-border/40 bg-muted/30 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {info.hasFile && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-semibold">{t('download.digitalBadge')}</Badge>
                  {info.isFree && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px] font-bold">{t('marketplace.free')}</Badge>}
                </div>
                <h1 className="mt-1.5 text-lg font-bold text-foreground sm:text-xl">{info.title}</h1>
                {info.fileName && (
                  <p className="mt-1 truncate text-[13px] text-muted-foreground" dir="ltr">
                    {info.fileName}{info.fileSize ? ` · ${formatSize(info.fileSize)}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {entitled ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {autoStarted ? t('download.started') : t('download.ready')}
                  </p>
                </div>
                <Button onClick={manualDownload} className="h-13 w-full gap-2 rounded-xl py-6 text-[15px] font-semibold shadow-lg shadow-primary/25">
                  <FileDown className="h-5 w-5" />
                  {t('download.manualBtn')}
                </Button>
                <p className="text-center text-[12px] text-muted-foreground">{t('download.autoHint')}</p>
              </div>
            ) : reason === 'PAYMENT_PENDING' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t('download.paymentPending')}</p>
                    <p className="mt-1 text-[12px] text-amber-600/80 dark:text-amber-400/70">
                      {dealStatus === 'payment_pending' ? t('download.paymentPendingDesc') : t('download.orderPendingDesc')}
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => { const s = useAppStore.getState(); s.setDashboardPanel('my-deals'); s.setView('dashboard'); }} className="h-11 w-full gap-2 rounded-xl text-sm font-semibold">
                  <Package className="h-4 w-4" />{t('download.viewMyDeals')}
                </Button>
              </div>
            ) : info.isFree && user ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('download.claimFreeDesc')}</p>
                <Button onClick={claimFree} disabled={claiming} className="h-13 w-full gap-2 rounded-xl py-6 text-[15px] font-semibold shadow-lg shadow-primary/25">
                  {claiming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                  {claiming ? t('download.claiming') : t('download.claimFree')}
                </Button>
              </div>
            ) : info.isFree ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3.5">
                  <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('download.loginRequired')}</p>
                </div>
                <Button onClick={() => setView('auth')} className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25">
                  <LogIn className="h-5 w-5" />{t('nav.loginRegister')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3.5">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('download.buyRequired')}</p>
                </div>
                <Button onClick={openProduct} className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25">
                  <ShoppingCart className="h-5 w-5" />{t('download.goToProduct')}
                </Button>
              </div>
            )}
          </div>

          {/* Trust footer */}
          <div className="flex items-center justify-center gap-1.5 border-t border-border/40 bg-muted/20 px-5 py-3">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground">{t('download.secureNote')}</span>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
