'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  LogIn,
  Save,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Info,
  ShieldCheck,
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

const GOOGLE_OAUTH_FIELDS = [
  {
    key: 'google_client_id',
    label: 'Client ID',
    placeholder: '123456789-abc.apps.googleusercontent.com',
    description: 'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID',
    isSecret: false,
  },
  {
    key: 'google_client_secret',
    label: 'Client Secret',
    placeholder: 'GOCSPX-xxxxxxxxxxxxxxxx',
    description: '同一 Credentials পেজে পাবেন',
    isSecret: true,
  },
  {
    key: 'google_redirect_url',
    label: 'Redirect URL (Website Redirect URI)',
    placeholder: 'https://yourdomain.com/api/auth/google/callback',
    description: 'Google Cloud Console → Authorized redirect URIs এ এই URL যোগ করুন',
    isSecret: false,
  },
];

export function GoogleOAuthPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch('/api/admin/google-oauth')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          const s: Record<string, string> = {
            google_client_id: data.google_client_id || '',
            google_client_secret: data.google_client_secret || '',
            google_redirect_url: data.google_redirect_url || '',
          };
          setSettings(s);
          setOriginalSettings(s);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasChanged = GOOGLE_OAUTH_FIELDS.some(
    (f) => settings[f.key] !== originalSettings[f.key],
  );

  const isConfigured =
    !!(settings.google_client_id && settings.google_client_secret && settings.google_redirect_url);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/google-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setOriginalSettings({ ...settings });
        toast.success('Google OAuth সেটিংস সেভ হয়েছে');
      } else {
        toast.error(data.error || 'সেভ করতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('কপি হয়েছে');
  };

  const autoDetectRedirectUrl = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.origin + '/api/auth/google/callback';
      setSettings((prev) => ({ ...prev, google_redirect_url: url }));
      toast.success('Redirect URL সেট হয়েছে');
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
          <LogIn className="h-5 w-5 text-primary" />
          Google OAuth
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-center sm:text-left">
          Google দিয়ে লগইন সিস্টেম কনফিগার করুন
        </p>
      </div>

      {/* ── Status Banner ── */}
      <SolidCard>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 p-3">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
          ) : isConfigured ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {loading
                ? 'চেক করা হচ্ছে...'
                : isConfigured
                  ? 'Google OAuth সক্রিয় আছে'
                  : 'Google OAuth কনফিগার করা হয়নি'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {loading
                ? ''
                : isConfigured
                  ? 'ইউজাররা এখন Google দিয়ে লগইন করতে পারবে'
                  : 'Client ID, Secret এবং Redirect URL দিন'}
            </p>
          </div>
          {isConfigured && !loading && (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700 shrink-0">
              সক্রিয়
            </Badge>
          )}
        </div>
      </SolidCard>

      {/* ── Setup Guide ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">সেটআপ গাইড</p>
            <p className="text-[11px] text-muted-foreground">Google Cloud Console থেকে ক্রেডেনশিয়াল নিন</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1.5">
              <p className="font-semibold">Google Cloud Console এ যান:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li><strong>APIs & Services → Credentials</strong> এ যান</li>
                <li><strong>Create Credentials → OAuth client ID</strong> ক্লিক করুন</li>
                <li>Application type: <strong>Web application</strong> নির্বাচন করুন</li>
                <li>Authorized redirect URIs এ নিচের URL যোগ করুন</li>
                <li>Client ID ও Client Secret কপি করুন</li>
              </ol>
            </div>
          </div>

          {/* Quick copy redirect URL */}
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Redirect URL:</span>
            <code className="flex-1 text-xs font-mono text-foreground bg-muted px-2 py-1 rounded break-all">
              {settings.google_redirect_url || (typeof window !== 'undefined' ? window.location.origin : '')}/api/auth/google/callback
            </code>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  (settings.google_redirect_url || (typeof window !== 'undefined' ? window.location.origin : '')) + '/api/auth/google/callback'
                )
              }
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="কপি করুন"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </SolidCard>

      {/* ── Credentials ── */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">ক্রেডেনশিয়াল</p>
            <p className="text-[11px] text-muted-foreground">Google OAuth ক্রেডেনশিয়াল সেট করুন</p>
          </div>
          {hasChanged && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 shrink-0">
              পরিবর্তন আছে
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">লোড হচ্ছে...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {GOOGLE_OAUTH_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center">
                  <Label
                    htmlFor={f.key}
                    className="text-sm font-medium text-foreground text-center sm:text-left"
                  >
                    {f.label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={f.key}
                      type={f.isSecret && !showSecret ? 'password' : 'text'}
                      value={settings[f.key] || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                      className="pr-10"
                    />
                    {f.isSecret && (
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 sm:ml-[220px] text-center sm:text-left">
                  {f.description}
                </p>
              </div>
            ))}

            {/* Auto-detect redirect URL button */}
            <div className="flex items-center gap-2 sm:ml-[220px]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 text-xs"
                onClick={autoDetectRedirectUrl}
              >
                <ExternalLink className="h-3 w-3" />
                Redirect URL অটো-ডিটেক্ট
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center sm:justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanged || loading}
            className="h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md shadow-primary/20"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </div>
      </SolidCard>
    </motion.div>
  );
}
