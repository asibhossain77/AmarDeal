'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import {
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  QrCode,
  Smartphone,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

/* ═══════════════════════════════════════════
   SolidCard (matches admin design)
   ═══════════════════════════════════════════ */

function SolidCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-3.5 sm:p-5 shadow-lg dark:bg-zinc-900 ${className}`}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Section Header
   ═══════════════════════════════════════════ */

function SectionHeader({
  icon,
  title,
  desc,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          {badge}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   2FA Panel
   ═══════════════════════════════════════════ */

export function TwoFactorPanel() {
  const user = useAppStore((s) => s.user);

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [disabling, setDisabling] = useState(false);

  // Setup state
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [enabling, setEnabling] = useState(false);

  // Disable state
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  // Copy secret
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/admin/2fa/status');
      if (res.ok) {
        const data = await res.json();
        setTotpEnabled(data.totpEnabled);
      } else {
        console.warn('2FA status fetch failed:', res.status);
      }
    } catch (err) {
      console.warn('2FA status fetch error:', err);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Setup: Generate QR ──
  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'সেটআপ ব্যর্থ হয়েছে');
        return;
      }
      setQrDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setSettingUp(true);
      toast.success('QR কোড তৈরি হয়েছে');
    } catch {
      toast.error('সার্ভার ত্রুটি');
    } finally {
      setLoading(false);
    }
  };

  // ── Enable: Verify code ──
  const handleEnable = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('6 ডিজিটের কোড দিন');
      return;
    }
    setEnabling(true);
    try {
      const res = await fetch('/api/admin/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'ভুল কোড');
        return;
      }
      setTotpEnabled(true);
      setSettingUp(false);
      setVerifyCode('');
      setQrDataUrl('');
      setSecret('');
      toast.success('টু-ফ্যাক্টর অথেনটিকেশন সফলভাবে চালু হয়েছে!');
    } catch {
      toast.error('সার্ভার ত্রুটি');
    } finally {
      setEnabling(false);
    }
  };

  // ── Disable ──
  const handleDisable = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('6 ডিজিটের কোড দিন');
      return;
    }
    setDisabling(true);
    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'ভুল কোড');
        return;
      }
      setTotpEnabled(false);
      setShowDisable(false);
      setDisableCode('');
      toast.success('টু-ফ্যাক্টর অথেনটিকেশন বন্ধ হয়েছে');
    } catch {
      toast.error('সার্ভার ত্রুটি');
    } finally {
      setDisabling(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cancelSetup = () => {
    setSettingUp(false);
    setQrDataUrl('');
    setSecret('');
    setVerifyCode('');
  };

  if (loading) {
    return (
      <SolidCard className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </SolidCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <SectionHeader
        icon={<ShieldAlert className="h-5 w-5 text-primary" />}
        title="টু-ফ্যাক্টর অথেনটিকেশন (2FA)"
        desc="Google Authenticator দিয়ে আপনার অ্যাকাউন্ট সুরক্ষিত রাখুন"
        badge={
          totpEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> সক্রিয়
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              নিষ্ক্রিয়
            </span>
          )
        }
      />

      {/* ── Setup Flow (QR + Verify) ── */}
      {settingUp && (
        <SolidCard>
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <QrCode className="h-7 w-7 text-primary" />
                </div>
              </div>
              <h4 className="text-base font-bold text-foreground">
                Google Authenticator সেটআপ করুন
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                নিচের QR কোড স্ক্যান করুন অথবা ম্যানুয়ালি কোড কপি করে Google Authenticator অ্যাপে পেস্ট করুন
              </p>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex justify-center">
                <div className="rounded-xl border-2 border-dashed border-primary/30 p-4 bg-white">
                  <img
                    src={qrDataUrl}
                    alt="2FA QR Code"
                    className="h-48 w-48"
                  />
                </div>
              </div>
            )}

            {/* Secret Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                ম্যানুয়ালি কোড (Secret Key)
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={secret}
                  className="font-mono text-sm bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySecret}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'কপি হয়েছে' : 'কপি'}
                </Button>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                গুরুত্বপূর্ণ নির্দেশনা
              </div>
              <ol className="text-xs text-amber-700/80 dark:text-amber-400/80 space-y-1.5 list-decimal list-inside">
                <li>Google Authenticator অ্যাপ ইনস্টল করুন</li>
                <li>QR কোড স্ক্যান করুন অথবা ম্যানুয়ালি কোড দিন</li>
                <li>অ্যাপে দেখানো 6 ডিজিটের কোড নিচে দিন</li>
                <li>এই কোড ছাড়া আপনি লগইন করতে পারবেন না</li>
              </ol>
            </div>

            {/* Verify Code */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                ভেরিফিকেশন কোড দিন
              </label>
              <div className="flex gap-3">
                <Input
                  placeholder="6 ডিজিটের কোড"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="font-mono text-lg tracking-widest text-center max-w-[200px]"
                  maxLength={6}
                />
                <Button
                  onClick={handleEnable}
                  disabled={verifyCode.length !== 6 || enabling}
                  className="gap-2"
                >
                  {enabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {enabling ? 'যাচাই হচ্ছে...' : 'সক্রিয় করুন'}
                </Button>
              </div>
            </div>

            {/* Cancel */}
            <Button
              variant="ghost"
              onClick={cancelSetup}
              className="w-full text-muted-foreground"
            >
              বাতিল করুন
            </Button>
          </div>
        </SolidCard>
      )}

      {/* ── Status Card ── */}
      {!settingUp && (
        <SolidCard>
          <div className="space-y-4">
            {totpEnabled ? (
              <>
                {/* Enabled State */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                    <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground">
                      2FA সক্রিয় আছে
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      আপনার অ্যাকাউন্ট Google Authenticator দিয়ে সুরক্ষিত। লগইন করার সময় 6 ডিজিটের কোড প্রয়োজন হবে।
                    </p>
                  </div>
                </div>

                {/* Disable Button */}
                {!showDisable ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowDisable(true)}
                    className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    2FA বন্ধ করুন
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      সতর্কতা: 2FA বন্ধ করলে আপনার অ্যাকাউন্ট কম সুরক্ষিত হবে
                    </div>
                    <div className="flex gap-3">
                      <Input
                        placeholder="বর্তমান 6 ডিজিটের কোড"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="font-mono text-sm tracking-widest"
                        maxLength={6}
                      />
                      <Button
                        variant="destructive"
                        onClick={handleDisable}
                        disabled={disableCode.length !== 6 || disabling}
                        className="gap-2 shrink-0"
                      >
                        {disabling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        নিশ্চিত করুন
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowDisable(false); setDisableCode(''); }}
                      className="text-muted-foreground"
                    >
                      বাতিল
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Disabled State */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-700">
                    <Smartphone className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground">
                      2FA নিষ্ক্রিয়
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      আপনার অ্যাকাউন্টে টু-ফ্যাক্টর অথেনটিকেশন চালু নেই। শুধুমাত্র পাসওয়ার্ড দিয়ে লগইন করা যাচ্ছে।
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSetup}
                  className="w-full gap-2 shadow-lg shadow-primary/20"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Google Authenticator সেটআপ করুন
                </Button>
              </>
            )}
          </div>
        </SolidCard>
      )}
    </div>
  );
}