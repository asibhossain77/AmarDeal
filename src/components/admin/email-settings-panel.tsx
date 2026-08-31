'use client';
import { LoadingAnimation } from '@/components/shared/loading-animation'
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
  Power,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  { type: 'welcome', label: 'Welcome Email', description: 'New user registration', icon: '🎉' },
  { type: 'email_verification_otp', label: 'Email Verification OTP', description: 'After registration', icon: '✉️' },
  { type: 'password_reset_otp', label: 'Password Reset OTP', description: 'Forgot password', icon: '🔑' },
  { type: 'deal_created', label: 'Deal Created', description: 'New deal request', icon: '🤝' },
  { type: 'payment_submitted', label: 'Payment Submitted', description: 'When payment submitted', icon: '💰' },
  { type: 'payment_verified', label: 'Payment Verified', description: 'Admin verified payment', icon: '✅' },
  { type: 'delivery_started', label: 'Delivery Started', description: 'Seller delivered', icon: '📦' },
  { type: 'deal_completed', label: 'Deal Completed', description: 'Buyer confirmed', icon: '🎊' },
  { type: 'deal_cancelled', label: 'Deal Cancelled', description: 'Deal cancelled', icon: '❌' },
  { type: 'dispute_raised', label: 'Dispute Raised', description: 'Buyer disputed', icon: '⚠️' },
  { type: 'dispute_resolved', label: 'Dispute Resolved', description: 'Admin resolved', icon: '⚖️' },
  { type: 'login_notification', label: 'Login Notification', description: 'New login', icon: '🔐' },
  { type: 'payout_requested', label: 'Payout Requested', description: 'Payout/refund request', icon: '💸' },
  { type: 'payout_completed', label: 'Payout Completed', description: 'Admin paid', icon: '💳' },
];

const BREVO_FIELDS = [
  { key: 'brevo_smtp_key', label: 'SMTP Key', placeholder: 'xkeysib-xxxxxxxxxxxx', description: 'Brevo Dashboard → SMTP & API → Create' },
  { key: 'brevo_smtp_user', label: 'SMTP User (Email)', placeholder: 'your@email.com', description: 'Your Brevo account login email' },
  { key: 'brevo_from_email', label: 'From Email', placeholder: 'noreply@yourdomain.com', description: 'Sender email (if empty, SMTP User will be used)' },
];

const TEMPLATE_FIELDS = [
  { key: 'email_site_name', labelKey: 'admin.email.siteName' as const, placeholder: 'Midman', description: 'Shows in email header and footer' },
  { key: 'email_from_name', labelKey: 'admin.email.fromSenderName' as const, placeholder: 'Midman', description: 'Email sender name (From Name)' },
  { key: 'email_site_url', labelKey: 'admin.email.siteUrl' as const, placeholder: 'https://example.com', description: 'Will be used in buttons and links' },
  { key: 'email_header_subtitle', labelKey: 'admin.email.headerSubtitle' as const, placeholder: 'Trusted platform for secure online transactions', description: 'Shows below name in header' },
  { key: 'email_footer_tagline', labelKey: 'admin.email.footerTagline' as const, placeholder: 'Buy safely, sell safely', description: 'Shows below brand name in footer' },
  { key: 'email_footer_year', labelKey: 'admin.email.footerYear' as const, placeholder: 'If empty, auto (2025)', description: 'Year shown in copyright — e.g., 2025 or 2024-2025' },
  { key: 'email_footer_copyright', labelKey: 'admin.email.footerCopyright' as const, placeholder: 'All rights reserved', description: 'Shows after year — e.g., All rights reserved' },
  { key: 'email_footer_notice', labelKey: 'admin.email.footerNotice' as const, placeholder: 'This email was sent automatically', description: 'Last line of footer — hidden if empty' },
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
  const [disabledTemplates, setDisabledTemplates] = useState<Record<string, boolean>>(
    () => Object.fromEntries(EMAIL_TEMPLATES.map((t) => [t.type, false]))
  );
  const [originalDisabled, setOriginalDisabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(EMAIL_TEMPLATES.map((t) => [t.type, false]))
  );
  const [savingToggles, setSavingToggles] = useState(false);

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
          setConfigError(data.error || t('admin.email.configNotFound'));
          setConfigStatus('not-configured');
        }
      })
      .catch(() => {
        setConfigStatus('error');
        setConfigError(t('admin.email.serverProblem'));
      });

    // Load all settings
    fetch('/api/admin/email-template-settings')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setSettings(data);
          setOriginalSettings(data);
          // Parse disabled templates
          if (data._disabledTemplates) {
            try {
              const parsed = JSON.parse(data._disabledTemplates);
              setDisabledTemplates(parsed);
              setOriginalDisabled(parsed);
            } catch {}
          }
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
        toast.success(t('admin.email.testSuccess', { label }));
      } else {
        updateResult(type, { status: 'error', message: data.error });
        toast.error(t('admin.email.testFailed', { label, error: data.error || '' }));
      }
    } catch {
      updateResult(type, { status: 'error', message: t('common.networkError') });
      toast.error(t('admin.email.testFailed', { label, error: t('common.networkError') }));
    }
  };

  const sendAllTests = async () => {
    setSendingAll(true);
    for (const template of EMAIL_TEMPLATES) {
      await sendTestEmail(template.type, template.label);
      await new Promise((r) => setTimeout(r, 500));
    }
    setSendingAll(false);
    toast.success(t('admin.email.allTestsSent'));
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
        toast.success(t('admin.email.verifySuccessBanner'));
      } else {
        setVerifyResult('error');
        toast.error(t('admin.email.verifyFailBanner'));
      }
    } catch {
      setVerifyResult('error');
      toast.error(t('admin.email.verifyFailBanner'));
    } finally {
      setVerifying(false);
    }
  };

  const disabledChanged = JSON.stringify(disabledTemplates) !== JSON.stringify(originalDisabled);

  const ALL_FIELDS = [...BREVO_FIELDS, ...TEMPLATE_FIELDS];
  const hasChanged = ALL_FIELDS.some(
    (f) => settings[f.key] !== originalSettings[f.key],
  ) || disabledChanged;

  const toggleTemplate = (type: string) => {
    setDisabledTemplates((prev) => {
      const updated = { ...prev, [type]: !prev[type] };
      return updated;
    });
  };

  const reloadSettings = async () => {
    try {
      const res = await fetch('/api/admin/email-template-settings');
      const data = await res.json();
      if (!data.error) {
        setSettings(data);
        setOriginalSettings(data);
        if (data._disabledTemplates) {
          try {
            const parsed = JSON.parse(data._disabledTemplates);
            setDisabledTemplates(parsed);
            setOriginalDisabled(parsed);
          } catch {}
        }
      }
    } catch {}
  };

  const handleSave = async () => {
    setSavingSettings(true);
    try {
      const payload = { ...settings, _disabledTemplates: JSON.stringify(disabledTemplates) };
      const res = await fetch('/api/admin/email-template-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Re-fetch from DB to verify persistence
        await reloadSettings();
        toast.success(t('admin.email.settingsSaved'));
      } else {
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveToggles = async () => {
    setSavingToggles(true);
    try {
      const payload = { ...settings, _disabledTemplates: JSON.stringify(disabledTemplates) };
      const res = await fetch('/api/admin/email-template-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Re-fetch from DB to verify persistence
        await reloadSettings();
        toast.success(t('admin.email.settingsSaved'));
      } else {
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setSavingToggles(false);
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
          {t('admin.email.title')}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-center sm:text-left">
          {t('admin.email.headerDesc')}
        </p>
      </div>

      {/* ── Brevo SMTP Credentials ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{t('admin.email.smtpSection')}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.email.smtpDesc')}</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">{t('admin.email.dbSaved')}</Badge>
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <LoadingAnimation size="md" />
            <span className="ml-2 text-sm text-muted-foreground">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning note */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {t('admin.email.envWarning')}
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
            <p className="text-sm font-bold text-foreground">{t('admin.email.templateCustom')}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.email.templateCustomDesc')}</p>
          </div>
          {hasChanged && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 shrink-0">
              {t('admin.email.hasChanges')}
            </Badge>
          )}
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <LoadingAnimation size="md" />
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
                  {t(f.labelKey)}
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
              <LoadingAnimation size="sm" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savingSettings ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </SolidCard>

      {/* ── Template Toggles ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Power className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{t('admin.email.templateToggles') || 'ইমেইল টেমপ্লেট অন/অফ'}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.email.templateTogglesDesc') || 'প্রতিটি টেমপ্লেট আলাদাভাবে চালু বা বন্ধ করুন'}</p>
          </div>
          {disabledChanged && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 shrink-0">
              {t('admin.email.hasChanges')}
            </Badge>
          )}
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <LoadingAnimation size="md" />
          </div>
        ) : (
          <div className="space-y-1">
            {EMAIL_TEMPLATES.map((template) => {
              const isOff = disabledTemplates[template.type] === true;
              return (
                <div
                  key={template.type}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    isOff
                      ? 'bg-muted/40 opacity-60'
                      : 'bg-muted/20 hover:bg-accent/30'
                  }`}
                >
                  <span className="text-lg shrink-0">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{template.label}</p>
                    <p className="text-[11px] text-muted-foreground">{template.description}</p>
                  </div>
                  <Switch
                    checked={!isOff}
                    onCheckedChange={() => toggleTemplate(template.type)}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex justify-center sm:justify-end">
          <Button
            onClick={handleSaveToggles}
            disabled={savingToggles || !disabledChanged || loadingSettings}
            className="h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md shadow-primary/20"
          >
            {savingToggles ? (
              <LoadingAnimation size="sm" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savingToggles ? t('common.saving') : t('common.save')}
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
            <p className="text-sm font-bold text-foreground">{t('admin.email.configAndVerify')}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.email.configVerifyDesc')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 p-3">
            {configStatus === 'loading' ? (
              <LoadingAnimation size="sm" className="shrink-0" />
            ) : configStatus === 'configured' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {configStatus === 'loading'
                  ? t('admin.email.checking')
                  : configStatus === 'configured'
                    ? t('admin.email.configured')
                    : configStatus === 'error'
                      ? t('admin.email.serverError')
                      : t('admin.email.notConfigured')}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {configStatus === 'loading'
                  ? ''
                  : configStatus === 'configured'
                    ? t('admin.email.configuredHint')
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
              {t('admin.email.emailAddress')}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="test-email"
                type="email"
                placeholder={t('admin.email.enterYourEmail')}
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
                  <LoadingAnimation size="sm" />
                ) : verifyResult === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : verifyResult === 'error' ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {verifying ? t('admin.email.verifying') : t('admin.email.verify')}
              </Button>
            </div>
          </div>

          {/* Verify result banners */}
          {verifyResult === 'success' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30 p-3">
              <Zap className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                {t('admin.email.verifySuccessBanner')}
              </p>
            </div>
          )}
          {verifyResult === 'error' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 p-3">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                {t('admin.email.verifyFailBanner')}
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
            <p className="text-sm font-bold text-foreground">{t('admin.email.templateTest')}</p>
            <p className="text-[11px] text-muted-foreground">{t('admin.email.templateTestDesc')}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {t('admin.email.templateCount', { count: EMAIL_TEMPLATES.length })}
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
                <><LoadingAnimation size="sm" className="mr-2" />{t('admin.email.sending')}</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />{t('admin.email.sendAllTests')}</>
              )}
            </Button>
            <Button onClick={resetResults} variant="outline" size="sm" disabled={sendingAll} className="rounded-xl">
              {t('admin.email.reset')}
            </Button>
            {configStatus !== 'configured' && (
              <p className="text-xs text-red-500">{t('admin.email.configureFirst')}</p>
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
                    {result?.status === 'loading' && <LoadingAnimation size="sm" />}
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
                      <LoadingAnimation size="sm" className="mr-1.5" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t('admin.email.sendTest')}
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