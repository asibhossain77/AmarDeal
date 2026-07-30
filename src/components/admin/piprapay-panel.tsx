'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CreditCard,
  Save,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Info,
  ShieldCheck,
  Zap,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { motion } from 'framer-motion';

function SolidCard({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl bg-white p-3.5 sm:p-5 shadow-lg dark:bg-zinc-900 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function PipraPayPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({
    piprapay_api_key: '',
    piprapay_base_url: 'https://sandbox.piprapay.com',
    piprapay_enabled: 'false',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetch('/api/admin/piprapay')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          const s: Record<string, string> = {
            piprapay_api_key: data.piprapay_api_key || '',
            piprapay_base_url: data.piprapay_base_url || 'https://sandbox.piprapay.com',
            piprapay_enabled: String(data.piprapay_enabled || 'false'),
          };
          setSettings(s);
          setOriginalSettings(s);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isEnabled = settings.piprapay_enabled === 'true';
  const isConfigured = !!(settings.piprapay_api_key && settings.piprapay_base_url);
  const hasChanged = PIPRAPAY_KEYS.some((k) => settings[k] !== originalSettings[k]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/piprapay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setOriginalSettings({ ...settings });
        toast.success('PipraPay সেটিংস সেভ হয়েছে');
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

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/payment/piprapay/webhook`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-lg font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
          <Zap className="h-5 w-5 text-primary" />
          PipraPay Gateway
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-center sm:text-left">
          অটোমেটিক পেমেন্ট গেটওয়ে কনফিগার করুন — bKash, Nagad, SSLCommerz
        </p>
      </div>

      {/* Status Banner */}
      <SolidCard>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 p-3">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
          ) : isEnabled && isConfigured ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {loading
                ? 'চেক করা হচ্ছে...'
                : isEnabled && isConfigured
                  ? 'PipraPay সক্রিয় আছে'
                  : isConfigured
                    ? 'PipraPay কনফিগার আছে কিন্তু নিষ্ক্রিয়'
                    : 'PipraPay কনফিগার করা হয়নি'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {loading ? '' : isEnabled && isConfigured ? 'ক্রেতারা এখন অটোমেটিক পেমেন্ট করতে পারবে' : 'API Key ও Base URL দিয়ে সক্রিয় করুন'}
            </p>
          </div>
          {isEnabled && isConfigured && !loading && (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700 shrink-0">
              সক্রিয়
            </Badge>
          )}
        </div>
      </SolidCard>

      {/* Toggle Switch */}
      <SolidCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">PipraPay সক্রিয়/নিষ্ক্রিয়</p>
              <p className="text-[11px] text-muted-foreground">অ্যাডমিন প্যানেল থেকে gateway অন/অফ করুন</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSettings((p) => ({ ...p, piprapay_enabled: p.piprapay_enabled === 'true' ? 'false' : 'true' }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isEnabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </SolidCard>

      {/* Webhook URL Info */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Webhook URL</p>
            <p className="text-[11px] text-muted-foreground">PipraPay Dashboard এ সেট করুন</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 p-3">
          <code className="flex-1 text-xs font-mono text-foreground bg-muted px-2 py-1 rounded break-all">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(webhookUrl)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="কপি করুন"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </SolidCard>

      {/* Credentials */}
      <SolidCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">কনফিগারেশন</p>
            <p className="text-[11px] text-muted-foreground">PipraPay API ক্রেডেনশিয়াল</p>
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
            {/* API Key */}
            <div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center">
                <Label htmlFor="piprapay_api_key" className="text-sm font-medium text-foreground text-center sm:text-left">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    id="piprapay_api_key"
                    type={showKey ? 'text' : 'password'}
                    value={settings.piprapay_api_key}
                    onChange={(e) => setSettings((p) => ({ ...p, piprapay_api_key: e.target.value }))}
                    placeholder="piprapay_xxxxx..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 sm:ml-[220px] text-center sm:text-left">
                PipraPay Dashboard → Developer → API Keys থেকে নিন
              </p>
            </div>

            {/* Base URL */}
            <div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center">
                <Label htmlFor="piprapay_base_url" className="text-sm font-medium text-foreground text-center sm:text-left">
                  Base URL
                </Label>
                <Input
                  id="piprapay_base_url"
                  type="text"
                  value={settings.piprapay_base_url}
                  onChange={(e) => setSettings((p) => ({ ...p, piprapay_base_url: e.target.value }))}
                  placeholder="https://sandbox.piprapay.com"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 sm:ml-[220px] text-center sm:text-left">
                Sandbox: https://sandbox.piprapay.com | Production: তোমার self-hosted URL
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 sm:justify-between">
          <a
            href="https://piprapay.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            piprapay.com এ যান
          </a>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanged || loading}
            className="h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md shadow-primary/20"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </div>
      </SolidCard>
    </motion.div>
  );
}

const PIPRAPAY_KEYS = ['piprapay_api_key', 'piprapay_base_url', 'piprapay_enabled'];
