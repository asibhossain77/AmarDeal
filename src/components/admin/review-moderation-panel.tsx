'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Star, Loader2, ShieldAlert, BadgeCheck, EyeOff, RotateCcw,
  Store, ArrowRight, History, CheckCircle2, XCircle, Flag, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n';

interface ModerationReview {
  id: string;
  rating: number;
  comment: string;
  status: string;
  sellerReply: string | null;
  sellerReplyAt: string | null;
  createdAt: string;
  user: { id: string; name: string; imageLink: string | null };
  seller: { id: string; name: string; businessName: string | null };
  order: { id: string; orderNumber: string; title: string } | null;
}

interface ModerationReport {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reporter: { id: string; name: string } | null;
  review: {
    id: string; rating: number; comment: string; status: string;
    sellerReply: string | null; createdAt: string;
    user: { id: string; name: string; imageLink: string | null };
    seller: { id: string; name: string; businessName: string | null };
  } | null;
}

interface ModerationLog {
  id: string;
  reviewId: string;
  action: string;
  adminName: string | null;
  note: string | null;
  createdAt: string;
}

interface StoreRequest {
  id: string;
  status: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  changes: Record<string, string>;
  seller: {
    id: string; name: string; email: string;
    businessName: string | null; isSeller: boolean; sellerDisabled: boolean;
  };
}

type Tab = 'reports' | 'reviews' | 'store';
const REASON_LABEL_KEYS: Record<string, string> = {
  abusive: 'sellerProfile.reasonAbusive',
  fraudulent: 'sellerProfile.reasonFraudulent',
  irrelevant: 'sellerProfile.reasonIrrelevant',
  spam: 'sellerProfile.reasonSpam',
  other: 'sellerProfile.reasonOther',
};

export function ReviewModerationPanel() {
  const t = useT();

  const [tab, setTab] = useState<Tab>('reports');
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [stats, setStats] = useState({ openReports: 0, hiddenReviews: 0, totalReviews: 0 });
  const [reviewFilter, setReviewFilter] = useState<'all' | 'published' | 'hidden'>('all');

  const [storeRequests, setStoreRequests] = useState<StoreRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const loadAll = useCallback(async (filter: 'all' | 'published' | 'hidden' = 'all') => {
    setLoading(true);
    try {
      const [modRes, storeRes] = await Promise.all([
        fetch(`/api/admin/review-moderation?status=${filter}`),
        fetch('/api/admin/store-requests'),
      ]);
      const modData = await modRes.json();
      if (modRes.ok) {
        setReports(modData.reports || []);
        setReviews(modData.reviews || []);
        setLogs(modData.logs || []);
        setStats(modData.stats || { openReports: 0, hiddenReviews: 0, totalReviews: 0 });
      } else {
        toast.error(modData.error || 'Failed');
      }
      const storeData = await storeRes.json();
      if (storeRes.ok) {
        setStoreRequests(storeData.requests || []);
        setPendingCount(storeData.pendingCount || 0);
      }
    } catch {
      toast.error('Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(reviewFilter); }, [loadAll, reviewFilter]);

  const changeReviewFilter = (f: 'all' | 'published' | 'hidden') => {
    setReviewFilter(f);
    loadAll(f);
  };

  const patchModeration = async (payload: Record<string, unknown>, actionKey: string) => {
    setActing(actionKey);
    try {
      const res = await fetch('/api/admin/review-moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        loadAll(reviewFilter);
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setActing(null);
    }
  };

  const patchStoreRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setActing(`store-${requestId}`);
    try {
      const res = await fetch('/api/admin/store-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, note: notes[`store-${requestId}`] || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'OK');
        loadAll(reviewFilter);
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setActing(null);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const openReports = reports.filter(r => r.status === 'open');
  const closedReports = reports.filter(r => r.status !== 'open');
  const pendingStoreRequests = storeRequests.filter(r => r.status === 'pending');
  const closedStoreRequests = storeRequests.filter(r => r.status !== 'pending');

  const noteFor = (key: string) => notes[key] || '';
  const setNoteFor = (key: string, v: string) => setNotes(s => ({ ...s, [key]: v }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('adminReviewMod.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('adminReviewMod.desc')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Flag, label: t('adminReviewMod.openReports'), value: stats.openReports, cls: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
          { icon: EyeOff, label: t('adminReviewMod.hiddenReviews'), value: stats.hiddenReviews, cls: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
          { icon: Star, label: t('adminReviewMod.totalReviews'), value: stats.totalReviews, cls: 'text-primary bg-primary/10' },
          { icon: Store, label: t('adminReviewMod.pendingRequests'), value: pendingCount, cls: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/50 p-3.5 shadow-sm">
            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg mb-2 ${s.cls}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'reports' as Tab, label: `${t('adminReviewMod.tabReports')} (${openReports.length})` },
          { key: 'reviews' as Tab, label: t('adminReviewMod.tabReviews') },
          { key: 'store' as Tab, label: `${t('adminReviewMod.tabStoreRequests')} (${pendingStoreRequests.length})` },
        ]).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
              tab === item.key
                ? 'bg-primary/10 text-primary border-2 border-primary/30'
                : 'bg-white dark:bg-zinc-900 border border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Reports tab ── */}
          {tab === 'reports' && (
            <div className="space-y-3">
              {openReports.length === 0 && closedReports.length === 0 && (
                <div className="text-center py-12 rounded-2xl border border-dashed border-border/40">
                  <ShieldAlert className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('adminReviewMod.noData')}</p>
                </div>
              )}

              {openReports.map((report) => {
                const key = `report-${report.id}`;
                return (
                  <div key={report.id} className="rounded-2xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-500/20 p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0 font-medium text-[10px] gap-1">
                        <Flag className="h-3 w-3" />
                        {t('adminReviewMod.open')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('adminReviewMod.reason')}: <span className="font-semibold text-foreground">{t((REASON_LABEL_KEYS[report.reason] || 'sellerProfile.reasonOther') as never)}</span>
                      </span>
                      {report.reporter && (
                        <span className="text-xs text-muted-foreground">· {t('adminReviewMod.reportedBy')}: {report.reporter.name}</span>
                      )}
                      <span className="text-xs text-muted-foreground/60">· {fmtDate(report.createdAt)}</span>
                    </div>

                    {report.details && (
                      <p className="text-sm text-foreground/80 bg-muted/40 rounded-lg px-3 py-2 mb-3">{report.details}</p>
                    )}

                    {report.review && (
                      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`h-3 w-3 ${s <= report.review!.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20'}`} />
                            ))}
                          </div>
                          <span className="text-xs font-medium text-foreground">{report.review.user.name}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                          <span className="text-xs text-muted-foreground">{report.review.seller.businessName || report.review.seller.name}</span>
                          {report.review.status === 'hidden' && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium text-[10px]">
                              {t('adminReviewMod.hidden')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{report.review.comment}</p>
                      </div>
                    )}

                    <Textarea
                      value={noteFor(key)}
                      onChange={(e) => setNoteFor(key, e.target.value)}
                      placeholder={t('adminReviewMod.notePlaceholder')}
                      rows={2}
                      maxLength={500}
                      className="text-sm mb-3"
                    />

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-xl gap-1.5"
                        disabled={acting === key || report.review?.status === 'hidden'}
                        onClick={() => patchModeration({ reportId: report.id, action: 'resolve_report', resolution: 'hide_review', note: noteFor(key) || undefined }, key)}
                      >
                        {acting === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {t('adminReviewMod.hideReview')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        disabled={acting === key}
                        onClick={() => patchModeration({ reportId: report.id, action: 'resolve_report', resolution: 'keep_review', note: noteFor(key) || undefined }, key)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('adminReviewMod.keepReview')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl gap-1.5 text-muted-foreground"
                        disabled={acting === key}
                        onClick={() => patchModeration({ reportId: report.id, action: 'resolve_report', resolution: 'dismiss', note: noteFor(key) || undefined }, key)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t('adminReviewMod.dismiss')}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {closedReports.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">{t('adminReviewMod.resolved')}</p>
                  <div className="space-y-2">
                    {closedReports.map((report) => (
                      <div key={report.id} className="rounded-xl bg-white dark:bg-zinc-900 border border-border/40 px-4 py-3 opacity-75">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <Badge className={`border-0 font-medium text-[10px] ${report.status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                            {report.status === 'resolved' ? t('adminReviewMod.resolved') : t('adminReviewMod.dismissed')}
                          </Badge>
                          <span className="text-muted-foreground">{t((REASON_LABEL_KEYS[report.reason] || 'sellerProfile.reasonOther') as never)}</span>
                          {report.review && <span className="text-muted-foreground/70">· {report.review.user.name} → {report.review.seller.businessName || report.review.seller.name}</span>}
                          {report.resolution === 'review_hidden' && <EyeOff className="h-3 w-3 text-amber-500" />}
                          <span className="text-muted-foreground/50 ml-auto">{fmtDate(report.reviewedAt)}</span>
                        </div>
                        {report.adminNote && <p className="text-[11px] text-muted-foreground mt-1">📝 {report.adminNote}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Reviews tab ── */}
          {tab === 'reviews' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['all', 'published', 'hidden'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => changeReviewFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      reviewFilter === f ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
                    }`}
                  >
                    {f === 'all' ? t('adminReviewMod.all') : f === 'published' ? t('adminReviewMod.published') : t('adminReviewMod.hidden')}
                  </button>
                ))}
              </div>

              {reviews.length === 0 && (
                <div className="text-center py-12 rounded-2xl border border-dashed border-border/40">
                  <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('adminReviewMod.noData')}</p>
                </div>
              )}

              {reviews.map((review) => {
                const key = `review-${review.id}`;
                const reviewLogs = logs.filter(l => l.reviewId === review.id);
                return (
                  <div key={review.id} className="rounded-2xl bg-white dark:bg-zinc-900 border border-border/50 p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-3.5 w-3.5 ${s <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{review.user.name}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground">{review.seller.businessName || review.seller.name}</span>
                      {review.order ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 font-medium text-[10px] px-1.5 py-0 h-4">
                          <BadgeCheck className="h-3 w-3" />
                          {t('adminReviewMod.verifiedPurchaseShort')}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-0 font-medium text-[10px] px-1.5 py-0 h-4 gap-1">
                          <Package className="h-3 w-3" />
                          {t('adminReviewMod.noOrder')}
                        </Badge>
                      )}
                      {review.status === 'hidden' && (
                        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-0 font-medium text-[10px] px-1.5 py-0 h-4">
                          <EyeOff className="h-3 w-3" />
                          {t('adminReviewMod.hidden')}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground/50 ml-auto">{fmtDate(review.createdAt)}</span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-1">{review.comment}</p>
                    {review.sellerReply && (
                      <p className="text-xs text-primary/80 bg-primary/5 rounded-lg px-2.5 py-1.5 mb-1">
                        ↩ {review.sellerReply}
                      </p>
                    )}

                    {/* Moderation history */}
                    {reviewLogs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {reviewLogs.map(log => (
                          <p key={log.id} className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
                            <History className="h-3 w-3" />
                            {log.action} · {log.adminName || 'Admin'} · {fmtDate(log.createdAt)}{log.note ? ` · ${log.note}` : ''}
                          </p>
                        ))}
                      </div>
                    )}

                    <Textarea
                      value={noteFor(key)}
                      onChange={(e) => setNoteFor(key, e.target.value)}
                      placeholder={t('adminReviewMod.notePlaceholder')}
                      rows={1}
                      maxLength={500}
                      className="text-xs mt-2 mb-2"
                    />

                    <div className="flex gap-2 flex-wrap">
                      {review.status === 'published' ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-xl gap-1.5"
                          disabled={acting === key}
                          onClick={() => patchModeration({ reviewId: review.id, action: 'hide', note: noteFor(key) || undefined }, key)}
                        >
                          {acting === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {t('adminReviewMod.hideReview')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1.5"
                          disabled={acting === key}
                          onClick={() => patchModeration({ reviewId: review.id, action: 'restore', note: noteFor(key) || undefined }, key)}
                        >
                          {acting === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {t('adminReviewMod.restoreReview')}
                        </Button>
                      )}
                      {review.sellerReply && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl gap-1.5 text-muted-foreground"
                          disabled={acting === key}
                          onClick={() => patchModeration({ reviewId: review.id, action: 'remove_reply', note: noteFor(key) || undefined }, key)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t('adminReviewMod.removeReply')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Store name change requests tab ── */}
          {tab === 'store' && (
            <div className="space-y-3">
              {pendingStoreRequests.length === 0 && closedStoreRequests.length === 0 && (
                <div className="text-center py-12 rounded-2xl border border-dashed border-border/40">
                  <Store className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('adminReviewMod.noData')}</p>
                </div>
              )}

              {pendingStoreRequests.map((request) => {
                const key = `store-${request.id}`;
                const requestedName = request.changes?.businessName || '—';
                return (
                  <div key={request.id} className="rounded-2xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-500/20 p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-0 font-medium text-[10px]">
                        {t('adminReviewMod.pendingRequests')}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">{request.seller.name}</span>
                      <span className="text-xs text-muted-foreground">({request.seller.email})</span>
                      <span className="text-[11px] text-muted-foreground/50 ml-auto">{fmtDate(request.createdAt)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      <div className="rounded-xl bg-muted/40 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">{t('adminReviewMod.currentName')}</p>
                        <p className="text-sm font-medium text-foreground truncate">{request.seller.businessName || '—'}</p>
                      </div>
                      <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-primary/60 mb-0.5">{t('adminReviewMod.requestedName')}</p>
                        <p className="text-sm font-semibold text-primary truncate">{requestedName}</p>
                      </div>
                    </div>

                    <Textarea
                      value={noteFor(key)}
                      onChange={(e) => setNoteFor(key, e.target.value)}
                      placeholder={t('adminReviewMod.notePlaceholder')}
                      rows={1}
                      maxLength={500}
                      className="text-xs mb-2"
                    />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl gap-1.5"
                        disabled={acting === key}
                        onClick={() => patchStoreRequest(request.id, 'approve')}
                      >
                        {acting === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {t('adminReviewMod.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        disabled={acting === key}
                        onClick={() => patchStoreRequest(request.id, 'reject')}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t('adminReviewMod.reject')}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {closedStoreRequests.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">{t('adminReviewMod.history')}</p>
                  <div className="space-y-2">
                    {closedStoreRequests.map((request) => (
                      <div key={request.id} className="rounded-xl bg-white dark:bg-zinc-900 border border-border/40 px-4 py-3 opacity-75">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <Badge className={`border-0 font-medium text-[10px] ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'}`}>
                            {request.status === 'approved' ? t('adminReviewMod.approved') : t('adminReviewMod.rejected')}
                          </Badge>
                          <span className="text-muted-foreground">{request.seller.name}: “{request.changes?.businessName || '—'}”</span>
                          <span className="text-muted-foreground/50 ml-auto">{fmtDate(request.reviewedAt)}</span>
                        </div>
                        {request.adminNote && <p className="text-[11px] text-muted-foreground mt-1">📝 {request.adminNote}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
