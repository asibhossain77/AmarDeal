'use client';
import { useT } from '@/lib/i18n';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Key,
  TestTube,
  ShieldCheck,
  Zap,
  Save,
  Eye,
  EyeOff,
  Server,
  Palette,
} from 'lucide-react';
import { motion } from 'framer-motion';

/* ─── Solid Card (matches admin-main.tsx) ─── */
function SolidCard({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl bg-white p-3.5 sm:p-5 shadow-lg dark:bg-zinc-900 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface EmailTestResult {
  type: string;
  label: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

const EMAIL_TEMPLATES: { type: string; label: string; description: string; icon: string }[] = [
  { type: 'welcome', label: 'ওয়েলকাম ইমেইল', description: 'নতুন ইউজার রেজিস্ট্রেশন', icon: '🎉' },
  { type: 'email_verification_otp', label: 'ইমেইল ভেরিফিকেশন OTP', description: 'রেজিস্ট্রেশনের পর', icon: '✉️' },
  { type: 'password_reset_otp', label: 'পাসওয়ার্ড রিসেট OTP', description: 'ফরগট পাসওয়ার্ড', icon: '🔑' },
  { type: 'deal_created', label: 'ডিল তৈরি', description: 'নতুন ডিল অনুরোধ জানানো', icon: '🤝' },
  { type: 'payment_submitted', label: 'পেমেন্ট জমা', description: 'পেমেন্ট সাবমিট হলে', icon: '💰' },
  { type: 'payment_verified', label: 'পেমেন্ট ভেরিফাইড', description: 'অ্যাডমিন পেমেন্ট ভেরিফাই করলে', icon: '✅' },
  { type: 'delivery_started', label: 'ডেলিভারি শুরু', description: 'বিক্রেতা ডেলিভারি দিলে', icon: '📦' },
  { type: 'deal_completed', label: 'ডিল সম্পন্ন', description: 'ক্রেতা কনফার্ম করলে', icon: '🎊' },
  { type: 'deal_cancelled', label: 'ডিল বাতিল', description: 'ডিল ক্যান্সেল হলে', icon: '❌' },
  { type: 'dispute_raised', label: 'বিরোধ দায়ের', description: 'ক্রেতা ডিসপিউট করলে', icon: '⚠️' },
  { type: 'dispute_resolved', label: 'বিরোধ নিষ্পত্তি', description: 'অ্যাডমিন রিজোলভ করলে', icon: '⚖️' },
  { type: 'login_notification', label: 'লগইন নোটিফিকেশন', description: 'নতুন লগইন হলে', icon: '🔐' },
  { type: 'payout_requested', label: 'পেআউট অনুরোধ', description: 'পেআউট/রিফান্ড রিকোয়েস্ট', icon: '💸' },
  { type: 'payout_completed', label: 'পেআউট সম্পন্ন', description: 'অ্যাডমিন পেমেন্ট দিলে', icon: '💳' },
];

const BREVO_FIELDS = [
  { key: 'brevo_smtp_key', label: 'SMTP Key', placeholder: 'xkeysib-xxxxxxxxxxxx', description: 'Brevo Dashboard → SMTP & API → তৈরি করুন' },
  { key: 'brevo_smtp_user', label: 'SMTP User (ইমেইল)', placeholder: 'your@email.com', description: 'আপনার Brevo অ্যাকাউন্টের লগইন ইমেইল' },
  { key: 'brevo_from_email', label: 'From Email', placeholder: 'noreply@yourdomain.com', description: 'প্রেরকের ইমেইল (খালি থাকলে SMTP User ব্যবহার হবে)' },
];

const TEMPLATE_FIELDS = [
  { key: 'email_site_name', label: 'সাইট নাম', placeholder: 'আমারডিল.বাংলা', description: 'ইমেইলের হেডার ও ফুটারে দেখাবে' },
  { key: 'email_from_name', label: 'প্রেরকের নাম', placeholder: 'আমারডিল.বাংলা', description: 'ইমেইল প্রেরকের নাম (From Name)' },
  { key: 'email_site_url', label: 'সাইট URL', placeholder: 'https://example.com', description: 'বাটন ও লিংকে ব্যবহৃত হবে' },
  { key: 'email_header_subtitle', label: 'হেডার সাবটাইটেল', placeholder: 'নিরাপদ অনলাইন লেনদেনের বিশ্বস্ত প্ল্যাটফর্ম', description: 'হেডারে নামের নিচে দেখাবে' },
  { key: 'email_footer_tagline', label: 'ফুটার ট্যাগলাইন', placeholder: 'নিরাপদে কিনুন, নিরাপদে বিক্রি করুন', description: 'ফুটারে ব্র্যান্ড নামের নিচে দেখাবে' },
  { key: 'email_footer_year', label: 'ফুটার ইয়ার (Year)', placeholder: 'খালি থাকলে অটো (2025)', description: 'কপিরাইটে যে ইয়ার দেখাবে — যেমন: 2025 বা 2024-2025' },
  { key: 'email_footer_copyright', label: 'ফুটার কপিরাইট টেক্সট', placeholder: 'সর্বস্বত্ব সংরক্ষিত', description: 'ইয়ারের পরে দেখাবে — যেমন: সর্বস্বত্ব সংরক্ষিত' },
  { key: 'email_footer_notice', label: 'ফুটার অটো-নোটিস', placeholder: 'এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে', description: 'ফুটারের শেষ লাইনে দেখাবে — খালি করলে লুকাবে' },
];

export function EmailSettingsPanel() {
  const t = useT();
  const [testEmail, setTestEmail] = useState('');
  const [sendingAll, setSendingAll] = useState(false);
  const [results, setResults] = useState<EmailTestResult[]>(
    EMAIL_TEMPLATES.map((tmpl) => ({ type: tmpl.type, label: tmpl.label, status: 'idle' })),
  );
  const [configStatus, setConfigStatus] = useState<'loading' | 'configured' | 'not-configured' | 'error'>('loading');
  const [configError, setConfigError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'idle' | 'success' | 'error'>('idle');

  /* ── Template settings state ── */
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});
  const [showSmtpKey, setShowSmtpKey] = useState(false);

  // Check email config on mount
  useEffect(() => {
    fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: '__check__' }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setConfigStatus('configured');
        } else {
          setConfigError(data.error || 'কনফিগারেশন পাওয়া যায়নি');
          setConfigStatus('not-configured');
        }
      })
      .catch(() => {
        setConfigStatus('error');
        setConfigError('সার্ভারে যোগাযোগ করতে সমস্যা হয়েছে');
      });

    // Load all settings
    fetch('/api/admin/email-template-settings')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setSettings(data);
          setOriginalSettings(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  const updateResult = (type: string, update: Partial<EmailTestResult>) => {
    setResults((prev) =>
      prev.map((r) => (r.type === type ? { ...r, ...update } : r))
    );
  };

  const sendTestEmail = async (type: string, label: string) => {
    updateResult(type, { status: 'loading' });
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, to: testEmail || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        updateResult(type, { status: 'success', message: data.message });
        toast.success(`${label} — সফল!`);
      } else {
        updateResult(type, { status: 'error', message: data.error });
        toast.error(`${label} — ব্যর্থ: ${data.error}`);
      }
    } catch {
      updateResult(type, { status: 'error', message: 'নেটওয়ার্ক ত্রুটি' });
      toast.error(`${label} — নেটওয়ার্ক ত্রুটি`);
    }
  };

  const sendAllTests = async () => {
    setSendingAll(true);
    for (const template of EMAIL_TEMPLATES) {
      await sendTestEmail(template.type, template.label);
      await new Promise((r) => setTimeout(r, 500));
    }
    setSendingAll(false);
    toast.success('সকল টেস্ট ইমেইল পাঠানো হয়েছে!');
  };

  const resetResults = () => {
    setResults(EMAIL_TEMPLATES.map((tmpl) => ({ type: tmpl.type, label: tmpl.label, status: "idle" })));
    setVerifyResult('idle');
  };

  const verifyConnection = async () => {
    setVerifying(true);
    setVerifyResult('idle');
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: '__verify__', to: testEmail || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyResult('success');
        toast.success('✅ ইমেইল ভেরিফিকেশন সফল! ইনবক্স চেক করুন।');
      } else {
        setVerifyResult('error');
        toast.error(`ভেরিফিকেশন ব্যর্থ: ${data.error}`);
      }
    } catch {
      setVerifyResult('error');
      toast.error('ভেরিফিকেশন ব্যর্থ: নেটওয়ার্ক ত্রুটি');
    } finally {
      setVerifying(false);
    }
  };

  const ALL_FIELDS = [...BREVO_FIELDS, ...TEMPLATE_FIELDS];
  const hasChanged = ALL_FIELDS.some(
    (f) => settings[f.key] !== originalSettings[f.key],
  );

  const handleSave = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/email-template-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setOriginalSettings({ ...settings });
        toast.success('সেটিংস সেভ হয়েছে!');
      } else {
        toast.error(data.error || 'সেভ করতে সমস্যা');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
          <Mail className="h-5 w-5 text-primary" />
          ইমেইল সেটিংস
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-center sm:text-left">
          Brevo SMTP কনফিগারেশন, টেমপ্লেট কাস্টমাইজেশন ও টেস্টিং
        </p>
      </div>

      {/* ── Brevo SMTP Credentials ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Brevo SMTP Credentials</p>
            <p className="text-[11px] text-muted-foreground">SMTP কী, ইউজার ও ফ্রম ইমেইল কনফিগার করুন</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">DB সংরক্ষিত</Badge>
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">লোড হচ্ছে...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning note */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>.env ফাইলের পরিবর্তে</strong> এখান থেকে Brevo credentials সেট করুন।
                DB-তে সংরক্ষিত থাকবে। দুই জায়গায়ই থাকলে DB এর ভ্যালু অগ্রাধিকার পাবে।
              </p>
            </div>

            {/* SMTP Fields */}
            <div className="space-y-4">
              {BREVO_FIELDS.map((f) => (
                <div
                  key={f.key}
                  className="grid grid-cols-1 gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center"
                >
                  <Label
                    htmlFor={f.key}
                    className="text-sm font-medium text-foreground text-center sm:text-left"
                  >
                    {f.label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={f.key}
                      type={f.key === 'brevo_smtp_key' && !showSmtpKey ? 'password' : 'text'}
                      value={settings[f.key] || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                      className="max-w-md"
                    />
                    {f.key === 'brevo_smtp_key' && (
                      <button
                        type="button"
                        onClick={() => setShowSmtpKey(!showSmtpKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showSmtpKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground sm:col-start-2 text-center sm:text-left">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </SolidCard>

      {/* ── Template Customization ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">টেমপ্লেট কাস্টমাইজেশন</p>
            <p className="text-[11px] text-muted-foreground">ইমেইল টেমপ্লেটের ব্র্যান্ডিং পরিবর্তন করুন</p>
          </div>
          {hasChanged && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 shrink-0">
              পরিবর্তন আছে
            </Badge>
          )}
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {TEMPLATE_FIELDS.map((f) => (
              <div
                key={f.key}
                className="grid grid-cols-1 gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center"
              >
                <Label
                  htmlFor={f.key}
                  className="text-sm font-medium text-foreground text-center sm:text-left"
                >
                  {f.label}
                </Label>
                <Input
                  id={f.key}
                  value={settings[f.key] || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                  className="max-w-md"
                />
                <p className="text-[11px] text-muted-foreground sm:col-start-2 text-center sm:text-left">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center sm:justify-end">
          <Button
            onClick={handleSave}
            disabled={savingSettings || !hasChanged || loadingSettings}
            className="h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md shadow-primary/20"
          >
            {savingSettings ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savingSettings ? 'সেভ হচ্ছে...' : 'সেটিংস সেভ করুন'}
          </Button>
        </div>
      </SolidCard>

      {/* ── Configuration & Verification ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">কনফিগারেশন ও ভেরিফিকেশন</p>
            <p className="text-[11px] text-muted-foreground">SMTP সংযোগ পরীক্ষা ও টেস্ট ইমেইল পাঠান</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 p-3">
            {configStatus === 'loading' ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
            ) : configStatus === 'configured' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {configStatus === 'loading'
                  ? 'চেক করা হচ্ছে...'
                  : configStatus === 'configured'
                    ? 'Brevo SMTP কনফিগার আছে'
                    : configStatus === 'error'
                      ? 'সার্ভার ত্রুটি'
                      : 'Brevo SMTP কনফিগার নেই'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {configStatus === 'loading'
                  ? ''
                  : configStatus === 'configured'
                    ? 'SMTP Key পাওয়া গেছে। নিচে থেকে ভেরিফাই করুন।'
                    : configError}
              </p>
            </div>
          </div>

          {/* Verify form */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
            <Label
              htmlFor="test-email"
              className="text-sm font-medium text-foreground text-center sm:text-left"
            >
              ইমেইল ঠিকানা
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="test-email"
                type="email"
                placeholder="আপনার ইমেইল দিন"
                value={testEmail}
                onChange={(e) => { setTestEmail(e.target.value); setVerifyResult('idle'); }}
                className="max-w-sm"
              />
              <Button
                onClick={verifyConnection}
                disabled={verifying || configStatus !== 'configured'}
                className="gap-2 rounded-xl shrink-0"
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : verifyResult === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : verifyResult === 'error' ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {verifying ? 'যাচাই হচ্ছে...' : 'ভেরিফাই'}
              </Button>
            </div>
          </div>

          {/* Verify result banners */}
          {verifyResult === 'success' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30 p-3">
              <Zap className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                <strong>ভেরিফিকেশন সফল!</strong> একটি টেস্ট ইমেইল পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার চেক করুন।
              </p>
            </div>
          )}
          {verifyResult === 'error' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 p-3">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                <strong>ভেরিফিকেশন ব্যর্থ।</strong> SMTP Key সঠিক কিনা চেক করুন।
              </p>
            </div>
          )}
        </div>
      </SolidCard>

      {/* ── Template Test ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TestTube className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">টেমপ্লেট টেস্ট</p>
            <p className="text-[11px] text-muted-foreground">প্রতিটি টেমপ্লেট আলাদাভাবে পরীক্ষা করুন</p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {EMAIL_TEMPLATES.length}টি টেমপ্লেট
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={sendAllTests}
              disabled={sendingAll || configStatus !== 'configured'}
              variant="default"
              size="sm"
              className="rounded-xl"
            >
              {sendingAll ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />পাঠানো হচ্ছে...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />সব টেস্ট পাঠান</>
              )}
            </Button>
            <Button onClick={resetResults} variant="outline" size="sm" disabled={sendingAll} className="rounded-xl">
              রিসেট
            </Button>
            {configStatus !== 'configured' && (
              <p className="text-xs text-red-500">প্রথমে SMTP কনফিগার করুন</p>
            )}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EMAIL_TEMPLATES.map((template) => {
              const result = results.find((r) => r.type === template.type);
              return (
                <div
                  key={template.type}
                  className="flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/20 p-4 hover:border-primary/30 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{template.icon}</span>
                    {result?.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {result?.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                    {result?.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  <p className="text-sm font-medium text-foreground">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                  {result?.message && (
                    <p className={`text-xs leading-relaxed ${result.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {result.message}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto w-full rounded-xl"
                    disabled={result?.status === 'loading' || sendingAll || configStatus !== 'configured'}
                    onClick={() => sendTestEmail(template.type, template.label)}
                  >
                    {result?.status === 'loading' ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    টেস্ট পাঠান
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </SolidCard>
    </motion.div>
  );
}