'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingAnimation } from '@/components/shared/loading-animation';
import { toast } from 'sonner';
import { Timer, CalendarClock, PencilLine, Check, AlertTriangle, Hourglass } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Seller work-duration commitment UI (shared by buyer's
   DealWorkflowTracker and SellerDealTracker).

   Flow: buyer pays → admin verifies → seller selects "কত দিনে
   কাজ সম্পন্ন হবে" → buyer sees a live countdown in their deal.
   ═══════════════════════════════════════════════════════════ */

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Convert Latin digits to Bengali digits for display */
export function toBn(n: number | string): string {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[+d]);
}

const PRESET_DAYS = [1, 3, 7, 15, 30];

const COMMIT_GREEN = '#65A30D';
const COMMIT_GREEN_MILD = 'rgba(101,163,13,0.08)';

/* ═══════════════════════════════════════════════════════════
   Seller side — commitment selector
   ═══════════════════════════════════════════════════════════ */

export function WorkDeadlineSelector({
  dealId,
  workDays,
  workDeadlineAt,
  onSet,
}: {
  dealId: string;
  workDays?: number | null;
  workDeadlineAt?: string | null;
  onSet?: (days: number, deadlineAt: string) => void;
}) {
  const hasCommitment = workDays != null && !!workDeadlineAt;
  const [editing, setEditing] = useState(!hasCommitment);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveDays = selectedDays ?? (customDays ? Number(customDays) : null);

  const handleSave = useCallback(async () => {
    if (!effectiveDays || effectiveDays < 1 || effectiveDays > 90 || !Number.isInteger(effectiveDays)) {
      toast.error('১ থেকে ৯০ এর মধ্যে দিন সংখ্যা লিখুন');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/set-deadline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: effectiveDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`কাজ সম্পন্নের সময়সীমা ${toBn(effectiveDays)} দিন নির্ধারিত হয়েছে`);
        setSelectedDays(null);
        setCustomDays('');
        setEditing(false);
        onSet?.(effectiveDays, data.workDeadlineAt);
      } else {
        toast.error(data.error || 'সময়সীমা নির্ধারণ করা যায়নি');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setSaving(false);
    }
  }, [effectiveDays, dealId, onSet]);

  const deadlineLabel = workDeadlineAt
    ? new Date(workDeadlineAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  /* ── Existing commitment summary (with change option) ── */
  if (hasCommitment && !editing) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border" style={{ backgroundColor: COMMIT_GREEN_MILD, borderColor: 'rgba(101,163,13,0.2)' }}>
        <CalendarClock className="h-4 w-4 md:h-5 md:w-5 shrink-0" style={{ color: COMMIT_GREEN }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm font-bold text-foreground">
            আপনি {toBn(workDays)} দিনের মধ্যে কাজ সম্পন্ন করার প্রতিশ্রুতি দিয়েছেন
          </p>
          <p className="text-[11px] md:text-xs text-muted-foreground">
            সময়সীমা: {deadlineLabel} — ক্রেতা কাউন্টডাউন দেখতে পাচ্ছেন
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          className="shrink-0 h-8 gap-1.5 text-xs rounded-lg"
        >
          <PencilLine className="h-3.5 w-3.5" />
          পরিবর্তন
        </Button>
      </div>
    );
  }

  /* ── Selector: preset chips + custom input ── */
  return (
    <div className="space-y-2.5 rounded-xl md:rounded-2xl border p-3.5 md:p-4" style={{ backgroundColor: COMMIT_GREEN_MILD, borderColor: 'rgba(101,163,13,0.2)' }}>
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 shrink-0" style={{ color: COMMIT_GREEN }} />
        <p className="text-xs md:text-sm font-bold text-foreground">
          কত দিনের মধ্যে কাজ সম্পন্ন করবেন?
        </p>
      </div>
      <p className="text-[11px] md:text-xs text-muted-foreground pl-6">
        সময়সীমা নির্ধারণ করলে ক্রেতার ডিলে কাউন্টডাউন দেখা যাবে
      </p>
      <div className="flex flex-wrap gap-2 pl-0.5">
        {PRESET_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setSelectedDays(d); setCustomDays(''); }}
            className="px-3.5 h-9 rounded-lg text-sm font-semibold border transition-colors"
            style={selectedDays === d
              ? { backgroundColor: COMMIT_GREEN, color: '#fff', borderColor: COMMIT_GREEN }
              : { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            {toBn(d)} দিন
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 pl-0.5">
        <Input
          type="number"
          min={1}
          max={90}
          inputMode="numeric"
          placeholder="অথবা নিজে লিখুন (১–৯০)"
          value={customDays}
          onChange={(e) => { setCustomDays(e.target.value); setSelectedDays(null); }}
          className="h-9 w-44 text-sm"
          dir="ltr"
        />
        <span className="text-xs text-muted-foreground">দিন</span>
        <Button
          onClick={handleSave}
          disabled={saving || !effectiveDays}
          className="ml-auto h-9 rounded-lg text-sm font-bold gap-1.5"
          style={{ backgroundColor: COMMIT_GREEN, color: '#fff' }}
        >
          {saving ? <LoadingAnimation size="sm" /> : <Check className="h-4 w-4" />}
          সময় নির্ধারণ করুন
        </Button>
        {hasCommitment && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9 text-xs">
            বাতিল
          </Button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Buyer side — live countdown card
   ═══════════════════════════════════════════════════════════ */

export function WorkDeadlineCountdown({
  workDays,
  workDeadlineAt,
}: {
  workDays: number;
  workDeadlineAt: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const deadlineMs = new Date(workDeadlineAt).getTime();
  const remainingMs = deadlineMs - now;
  const expired = remainingMs <= 0;

  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  /* Urgency colors: green > 24h, amber ≤ 24h, red when expired */
  const urgency = expired ? 'expired' : remainingMs < 24 * 3600 * 1000 ? 'soon' : 'ok';
  const accent = urgency === 'expired' ? '#EF4444' : urgency === 'soon' ? '#F59E0B' : COMMIT_GREEN;
  const bg = urgency === 'expired'
    ? 'rgba(239,68,68,0.08)'
    : urgency === 'soon'
      ? 'rgba(245,158,11,0.08)'
      : COMMIT_GREEN_MILD;
  const border = urgency === 'expired'
    ? 'rgba(239,68,68,0.25)'
    : urgency === 'soon'
      ? 'rgba(245,158,11,0.25)'
      : 'rgba(101,163,13,0.2)';

  const Icon = expired ? AlertTriangle : urgency === 'soon' ? Hourglass : Timer;

  return (
    <div
      className="rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0 mt-0.5" style={{ color: accent }} />
        <div className="min-w-0 flex-1">
          {expired ? (
            <>
              <p className="text-xs md:text-sm font-bold" style={{ color: accent }}>
                সময়সীমা শেষ হয়ে গেছে
              </p>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                বিক্রেতা {toBn(workDays)} দিনের মধ্যে কাজ সম্পন্ন করার প্রতিশ্রুতি দিয়েছিলেন — প্রয়োজনে অ্যাডমিনকে ডাকুন
              </p>
            </>
          ) : (
            <>
              <p className="text-xs md:text-sm font-bold text-foreground">
                বিক্রেতা {toBn(workDays)} দিনের মধ্যে কাজ সম্পন্ন করবেন
              </p>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                সময়সীমা: {new Date(deadlineMs).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              <p className="mt-1.5 text-base md:text-xl font-bold tabular-nums tracking-tight" style={{ color: accent }} dir="ltr">
                {toBn(d)} দিন {toBn(h)} ঘণ্টা {toBn(m)} মিনিট {toBn(s)} সেকেন্ড বাকি
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
