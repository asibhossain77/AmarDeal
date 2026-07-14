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
  const [configStatus, setConfigStatus] = useState<'loading' | 'configured' | 'not-configured'>('loading');
  const [configError, setConfigError] = useState('');

  // Check email config on mount
  useEffect(() => {
    fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: '__check__' }),
    })
      .then(async (res) => {
        if (res.ok || res.status === 400) {
          setConfigStatus('configured');
        } else {
          const data = await res.json().catch(() => ({}));
          setConfigError(data.error || '');
          setConfigStatus('not-configured');
        }
      })
      .catch(() => setConfigStatus('not-configured'));
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
          Brevo SMTP ইমেইল কনফিগারেশন এবং টেমপ্লেট টেস্টিং
        </p>
      </div>

      {/* Config Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            কনফিগারেশন স্ট্যাটাস
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                    ? 'Brevo SMTP সক্রিয়'
                    : 'Brevo SMTP কী সেট করা নেই'}
              </p>
              <p className="text-xs text-muted-foreground">
                {configStatus === 'configured'
                  ? 'ইমেইল পাঠানো সম্ভব। টেমপ্লেট টেস্ট করুন।'
                  : configError
                    ? configError
                    : '.env ফাইলে BREVO_SMTP_KEY এবং BREVO_SMTP_USER যোগ করুন'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Email Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            ইমেইল টেস্ট
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              টেস্ট ইমেইল ঠিকানা
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="আপনার ইমেইল দিন (ঐচ্ছিক)"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="max-w-sm"
              />
              <Button
                onClick={sendAllTests}
                disabled={sendingAll}
                variant="default"
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
              <Button onClick={resetResults} variant="outline" disabled={sendingAll}>
                রিসেট
              </Button>
            </div>
            {!testEmail && (
              <p className="text-xs text-muted-foreground mt-1.5">
                ⚡ ইমেইল না দিলে admin@demo.com এ পাঠানো হবে
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>Brevo SMTP</strong> ব্যবহার করা হচ্ছে। ফ্রি প্ল্যানে দিনে ৩০০ টি ইমেইল পাঠানো যায় (মাসে ~৯,০০০)।
              কাস্টম ডোমেইন যুক্ত করতে Brevo Dashboard → Settings → Senders, Domains & IP এ যান।
              <strong>BREVO_SMTP_USER</strong> = আপনার Brevo অ্যাকাউন্টের লগইন ইমেইল (যেটি দিয়ে brevo.com এ লগইন করেন)।
              <strong>BREVO_SMTP_KEY</strong> = Brevo থেকে প্রাপ্ত SMTP Key (xsmtpsib-... দিয়ে শুরু হয়)।
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            ইমেইল টেমপ্লেটসমূহ
            <Badge variant="secondary" className="ml-auto">
              {EMAIL_TEMPLATES.length}টি টেমপ্লেট
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                    disabled={result?.status === 'loading' || sendingAll}
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