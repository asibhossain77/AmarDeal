'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';

interface EmailTestResult {
  type: string;
  label: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

const EMAIL_TEMPLATES: { type: string; label: string; description: string; icon: string }[] = [
  { type: 'welcome', label: 'ওয়েলকাম ইমেইল', description: 'নতুন ইউজার রেজিস্ট্রেশন', icon: '🎉' },
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

export function EmailSettingsPanel() {
  const [testEmail, setTestEmail] = useState('');
  const [sendingAll, setSendingAll] = useState(false);
  const [results, setResults] = useState<EmailTestResult[]>(
    EMAIL_TEMPLATES.map((t) => ({ type: t.type, label: t.label, status: 'idle' }))
  );
  const [configStatus, setConfigStatus] = useState<'loading' | 'configured' | 'not-configured' | 'error'>('loading');
  const [configError, setConfigError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'idle' | 'success' | 'error'>('idle');

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
    } catch (err) {
      updateResult(type, { status: 'error', message: 'নেটওয়ার্ক ত্রুটি' });
      toast.error(`${label} — নেটওয়ার্ক ত্রুটি`);
    }
  };

  const sendAllTests = async () => {
    setSendingAll(true);
    for (const template of EMAIL_TEMPLATES) {
      await sendTestEmail(template.type, template.label);
      // Small delay between sends to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }
    setSendingAll(false);
    toast.success('সকল টেস্ট ইমেইল পাঠানো হয়েছে!');
  };

  const resetResults = () => {
    setResults(EMAIL_TEMPLATES.map((t) => ({ type: t.type, label: t.label, status: 'idle' })));
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          ইমেইল সেটিংস
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Brevo SMTP ইমেইল কনফিগারেশন, ভেরিফিকেশন এবং টেমপ্লেট টেস্টিং
        </p>
      </div>

      {/* Config Status + Verify Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            কনফিগারেশন ও ভেরিফিকেশন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            {configStatus === 'loading' ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : configStatus === 'configured' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {configStatus === 'loading'
                  ? 'চেক করা হচ্ছে...'
                  : configStatus === 'configured'
                    ? 'Brevo SMTP কনফিগার আছে'
                    : configStatus === 'error'
                      ? 'সার্ভার ত্রুটি'
                      : 'Brevo SMTP কনফিগার নেই'}
              </p>
              <p className="text-xs text-muted-foreground">
                {configStatus === 'loading'
                  ? ''
                  : configStatus === 'configured'
                    ? 'SMTP Key এবং User পাওয়া গেছে। নিচে থেকে ভেরিফাই করুন।'
                    : configError}
              </p>
            </div>
          </div>

          {/* Verify Connection */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-border/50">
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                ইমেইল ঠিকানা
              </label>
              <Input
                type="email"
                placeholder="আপনার ইমেইল দিন (ভেরিফিকেশন ইমেইল পাঠানো হবে)"
                value={testEmail}
                onChange={(e) => { setTestEmail(e.target.value); setVerifyResult('idle'); }}
                className="max-w-sm"
              />
            </div>
            <div className="flex gap-2 shrink-0 mt-2 sm:mt-6">
              <Button
                onClick={verifyConnection}
                disabled={verifying || configStatus !== 'configured'}
                className="gap-2"
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
                {verifying ? 'যাচাই হচ্ছে...' : 'ভেরিফাই করুন'}
              </Button>
            </div>
          </div>

          {/* Verify result message */}
          {verifyResult === 'success' && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30 p-3">
              <Zap className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-xs text-green-800 dark:text-green-300">
                <strong>ভেরিফিকেশন সফল!</strong> একটি টেস্ট ইমেইল পাঠানো হয়েছে। আপনার ইনবক্স (এবং স্প্যাম ফোল্ডার) চেক করুন।
              </p>
            </div>
          )}
          {verifyResult === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 p-3">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 dark:text-red-300">
                <strong>ভেরিফিকেশন ব্যর্থ।</strong> SMTP Key বা User সঠিক কিনা চেক করুন। Brevo Dashboard থেকে নতুন SMTP Key তৈরি করতে পারেন।
              </p>
            </div>
          )}

          {/* Info box */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>Brevo SMTP</strong> ব্যবহার করা হচ্ছে। ফ্রি প্ল্যানে দিনে ৩০০ টি ইমেইল পাঠানো যায় (মাসে ~৯,০০০)।
              <br />
              <strong>BREVO_SMTP_KEY</strong> = Brevo Dashboard → Settings → SMTP & API থেকে প্রাপ্ত Key (<code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded text-[11px]">xkeysib-...</code> দিয়ে শুরু হয়)।
              <br />
              <strong>BREVO_SMTP_USER</strong> = আপনার Brevo অ্যাকাউন্টের লগইন ইমেইল।
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test All Templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            টেমপ্লেট টেস্ট
            <Badge variant="secondary" className="ml-auto">
              {EMAIL_TEMPLATES.length}টি টেমপ্লেট
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={sendAllTests}
              disabled={sendingAll || configStatus !== 'configured'}
              variant="default"
              size="sm"
            >
              {sendingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  পাঠানো হচ্ছে...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  সব টেস্ট পাঠান
                </>
              )}
            </Button>
            <Button onClick={resetResults} variant="outline" size="sm" disabled={sendingAll}>
              রিসেট
            </Button>
            {configStatus !== 'configured' && (
              <p className="text-xs text-red-500">প্রথমে SMTP কনফিগার করুন</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EMAIL_TEMPLATES.map((template) => {
              const result = results.find((r) => r.type === template.type);
              return (
                <div
                  key={template.type}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 p-4 hover:border-primary/30 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{template.icon}</span>
                    {result?.status === 'success' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {result?.status === 'error' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    {result?.status === 'loading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                  {result?.message && (
                    <p className={`text-xs ${result.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {result.message}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto w-full"
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
        </CardContent>
      </Card>
    </div>
  );
}