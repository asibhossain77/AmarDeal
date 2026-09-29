'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Hourglass, Mail, MailCheck, ShieldAlert } from 'lucide-react';
import { toBn } from './work-deadline';

/* Bengali date label, e.g. "২৭ অক্টোবর, ২০২৬" */
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export function bnDateLabel(d: Date | string | number): string {
  const dt = new Date(d);
  return `${toBn(dt.getDate())} ${BN_MONTHS[dt.getMonth()]}, ${toBn(dt.getFullYear())}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/* ────────────────────────────────────────────────────────────
   Live countdown to the auto-complete moment (1s tick).
   Amber while waiting, red once the grace window has passed
   (the daily cron completes it within ~24h after that).
   ──────────────────────────────────────────────────────────── */
export function AutoCompleteCountdown({ autoCompleteAt }: { autoCompleteAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const deadlineMs = new Date(autoCompleteAt).getTime();
  const remainingMs = deadlineMs - now;
  const expired = remainingMs <= 0;

  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const accent = expired ? '#EF4444' : '#F59E0B';
  const bg = expired ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
  const border = expired ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';
  const Icon = expired ? AlertTriangle : Hourglass;

  return (
    <div className="rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0 mt-0.5" style={{ color: accent }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm font-bold text-foreground">
            স্বয়ংক্রিয় সম্পন্নের সময়সীমা: {bnDateLabel(deadlineMs)}
          </p>
          {expired ? (
            <p className="text-[11px] md:text-xs mt-1 font-semibold" style={{ color: accent }}>
              সময় শেষ — ডিলটি শীঘ্রই স্বয়ংক্রিয়ভাবে সম্পন্ন হবে
            </p>
          ) : (
            <p className="mt-1.5 text-base md:text-xl font-bold tabular-nums tracking-tight" style={{ color: accent }} dir="ltr">
              {toBn(d)} দিন {toBn(h)} ঘণ্টা {toBn(m)} মিনিট {toBn(s)} সেকেন্ড বাকি
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Seller-side card (status = in_delivery):
   • < 3 days since delivery  → muted hint (can't send yet)
   • ≥ 3 days, not sent       → "রিমাইন্ডার ইমেইল পাঠান" action
   • sent                     → confirmation + live auto-complete countdown
   ──────────────────────────────────────────────────────────── */
export function DeliveryReminderCard({
  dealId,
  deliveredAt,
  reminderEmailSentAt,
  autoCompleteAt,
  onUpdated,
}: {
  dealId: string;
  deliveredAt?: string | null;
  reminderEmailSentAt?: string | null;
  autoCompleteAt?: string | null;
  onUpdated?: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(reminderEmailSentAt || null);
  const [autoAt, setAutoAt] = useState<string | null>(autoCompleteAt || null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setSentAt(reminderEmailSentAt || null);
    setAutoAt(autoCompleteAt || null);
  }, [reminderEmailSentAt, autoCompleteAt]);

  const elapsed = deliveredAt ? nowTick - new Date(deliveredAt).getTime() : null;
  const canSend = !sentAt && elapsed !== null && elapsed >= 3 * DAY_MS;
  const waitDays = elapsed !== null ? Math.max(0, Math.ceil((3 * DAY_MS - elapsed) / DAY_MS)) : null;

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/send-reminder`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'রিমাইন্ডার পাঠাতে সমস্যা হয়েছে');
      } else {
        setSentAt(data.reminderEmailSentAt || new Date().toISOString());
        setAutoAt(data.autoCompleteAt || null);
        onUpdated?.();
      }
    } catch {
      setError('রিমাইন্ডার পাঠাতে সমস্যা হয়েছে');
    } finally {
      setSending(false);
    }
  }

  /* Already sent → confirmation + countdown */
  if (sentAt) {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center gap-2.5 rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border" style={{ backgroundColor: 'rgba(101,163,13,0.08)', borderColor: 'rgba(101,163,13,0.2)' }}>
          <MailCheck className="h-4 w-4 md:h-5 md:w-5 shrink-0" style={{ color: '#65A30D' }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm font-bold text-foreground">রিমাইন্ডার ইমেইল পাঠানো হয়েছে</p>
            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
              পাঠানো হয়েছে: {bnDateLabel(sentAt)} — বয়ারের ইমেইলে স্বয়ংক্রিয় সম্পন্নের তারিখ জানানো হয়েছে
            </p>
          </div>
        </div>
        {autoAt && <AutoCompleteCountdown autoCompleteAt={autoAt} />}
      </div>
    );
  }

  /* Not sent yet */
  return (
    <div className="w-full space-y-2">
      <div className="rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border" style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.22)' }}>
        <div className="flex items-start gap-2.5">
          <BellRing className="h-4 w-4 md:h-5 md:w-5 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm font-bold text-foreground">বয়ার নিশ্চিত করছেন না?</p>
            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5 leading-relaxed">
              রিমাইন্ডার ইমেইল পাঠালে বয়ারের ১ মাস সময় পাবে — তার মধ্যে &quot;পণ্য/সার্ভিস পেয়েছি&quot; ক্লিক না করলে ডিল স্বয়ংক্রিয়ভাবে সম্পন্ন হয়ে আপনার পেমেন্ট হোল্ড থেকে মুক্ত হবে। আপনি না পাঠালেও ডেলিভারির ৩ দিন পর আমরা স্বয়ংক্রিয়ভাবে রিমাইন্ডার পাঠিয়ে দেব।
            </p>
            {canSend ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
                style={{ backgroundColor: '#F59E0B' }}
              >
                <Mail className="h-3.5 w-3.5" />
                {sending ? 'পাঠানো হচ্ছে…' : 'বয়ারকে রিমাইন্ডার ইমেইল পাঠান'}
              </button>
            ) : (
              <p className="mt-1.5 text-[11px] md:text-xs font-semibold" style={{ color: '#F59E0B' }}>
                {waitDays !== null && waitDays > 0
                  ? `ডেলিভারির পর ৩ দিন পূর্ণ হলে পাঠাতে পারবেন (আরও ${toBn(waitDays)} দিন বাকি)`
                  : 'শীঘ্রই পাঠাতে পারবেন'}
              </p>
            )}
            {error && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Buyer-side warning (status = in_delivery, reminder already
   sent): explains the auto-complete consequence + countdown.
   ──────────────────────────────────────────────────────────── */
export function AutoCompleteWarning({ reminderEmailSentAt, autoCompleteAt }: { reminderEmailSentAt?: string | null; autoCompleteAt?: string | null }) {
  if (!autoCompleteAt) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5 rounded-xl md:rounded-2xl px-3.5 py-3 md:px-5 md:py-4 border" style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' }}>
        <ShieldAlert className="h-4 w-4 md:h-5 md:w-5 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm font-bold text-foreground">ডেলিভারি রিমাইন্ডার পাঠানো হয়েছে</p>
          <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {bnDateLabel(reminderEmailSentAt || new Date())} এ আপনাকে ইমেইল রিমাইন্ডার দেওয়া হয়েছে।{' '}
            <span className="font-bold" style={{ color: '#F59E0B' }}>
              সময়সীমার মধ্যে &quot;পণ্য/সার্ভিস পেয়েছি&quot; ক্লিক না করলে ডিল স্বয়ংক্রিয়ভাবে সম্পন্ন হয়ে বিক্রেতার পেমেন্ট মুক্ত হয়ে যাবে।
            </span>{' '}
            কোনো সমস্যা থাকলে &quot;বিরোধ&quot; বাটনে ক্লিক করুন।
          </p>
        </div>
      </div>
      <AutoCompleteCountdown autoCompleteAt={autoCompleteAt} />
    </div>
  );
}
