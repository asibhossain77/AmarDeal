'use client';
import { LoadingAnimation } from '@/components/shared/loading-animation';
import { useT } from '@/lib/i18n';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Key,
  TestTube,
  Zap,
  Save,
  Eye,
  EyeOff,
  Power,
  Radio,
  Users,
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

const WA_TEMPLATES: { type: string; label: string; description: string; icon: string }[] = [
  { type: 'deal_created', label: 'Deal Created', description: 'New deal request', icon: '🤝' },
  { type: 'payment_submitted', label: 'Payment Submitted', description: 'Payment submitted', icon: '💰' },
  { type: 'payment_verified', label: 'Payment Verified', description: 'Admin verified payment', icon: '✅' },
  { type: 'delivery_started', label: 'Delivery Started', description: 'Seller delivered', icon: '📦' },
  { type: 'deal_completed', label: 'Deal Completed', description: 'Buyer confirmed', icon: '🎊' },
  { type: 'deal_cancelled', label: 'Deal Cancelled', description: 'Deal cancelled', icon: '❌' },
  { type: 'dispute_raised', label: 'Dispute Raised', description: 'Buyer disputed', icon: '⚠️' },
  { type: 'dispute_resolved', label: 'Dispute Resolved', description: 'Admin resolved', icon: '⚖️' },
  { type: 'payout_requested', label: 'Payout Requested', description: 'Payout/refund request', icon: '💸' },
  { type: 'payout_completed', label: 'Payout Completed', description: 'Admin paid', icon: '💳' },
];

const WA_FIELDS = [
  { key: 'wa_phone_number_id', label: 'Phone Number ID', placeholder: '123456789012345', description: 'WhatsApp Cloud API → Phone Numbers → ID' },
  { key: 'wa_access_token', label: 'Access Token', placeholder: 'EAAxxxxxx...', description: 'Meta Business Suite → System User Token' },
  { key: 'wa_template_namespace', label: 'Template Namespace', placeholder: '(optional)', description: 'From WhatsApp Manager → Business Account' },
];

export function WhatsAppSettingsPanel() {
  const t = useT();

  /* ── Settings state ── */
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [disabledTemplates, setDisabledTemplates] = useState<Record<string, boolean>>({});
  const [originalDisabled, setOriginalDisabled] = useState<Record<string, boolean>>({});

  /* ── Test message state ── */
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);

  /* ── Broadcast state ── */
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

  /* ── Active section ── */
  const [activeSection, setActiveSection] = useState<'config' | 'templates' | 'broadcast'>('config');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/admin/whatsapp-settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data._disabledTemplates) {
          try {
            const disabled = JSON.parse(data._disabledTemplates);
            setDisabledTemplates(disabled);
            setOriginalDisabled(disabled);
          } catch {}
        }
      }
    } catch {
      toast.error('সেটিংস লোড করতে সমস্যা');
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          _disabledTemplates: JSON.stringify(disabledTemplates),
        }),
      });
      if (res.ok) {
        toast.success('সেটিংস সেভ হয়েছে');
        setOriginalDisabled({ ...disabledTemplates });
        fetchSettings(); // re-fetch to get masked token
      } else {
        toast.error('সেটিংস সেভ করতে সমস্যা');
      }
    } catch {
      toast.error('সেটিংস সেভ করতে সমস্যা');
    } finally {
      setSavingSettings(false);
    }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) {
      toast.error('ফোন নম্বর দিন');
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch('/api/admin/whatsapp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('টেস্ট মেসেজ পাঠানো হয়েছে');
      } else {
        toast.error(data.error || 'পাঠাতে সমস্যা');
      }
    } catch {
      toast.error('পাঠাতে সমস্যা');
    } finally {
      setTestSending(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      toast.error('মেসেজ লিখুন');
      return;
    }
    setBroadcastSending(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/admin/whatsapp-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMsg }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBroadcastResult({ total: data.total, sent: data.sent, failed: data.failed });
        toast.success(`ব্রডকাস্ট পাঠানো হয়েছে: ${data.sent}/${data.total}`);
      } else {
        toast.error(data.error || 'ব্রডকাস্টে সমস্যা');
      }
    } catch {
      toast.error('ব্রডকাস্টে সমস্যা');
    } finally {
      setBroadcastSending(false);
    }
  };

  const hasChanges = JSON.stringify(disabledTemplates) !== JSON.stringify(originalDisabled)
    || WA_FIELDS.some(f => settings[f.key] !== undefined);

  const isConfigured = !!(settings.wa_phone_number_id && settings.wa_access_token);

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingAnimation />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <SolidCard>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t('adminNav.whatsappSettings') || 'WhatsApp Settings'}</h2>
            <p className="text-xs text-muted-foreground">WhatsApp Cloud API configuration & broadcast</p>
          </div>
          <div className="ml-auto">
            {isConfigured ? (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-3 h-3 mr-1" /> কনফিগার্ড
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="w-3 h-3 mr-1" /> কনফিগার করুন
              </Badge>
            )}
          </div>
        </div>
      </SolidCard>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { key: 'config' as const, label: 'API কনফিগারেশন', icon: Key },
          { key: 'templates' as const, label: 'টেমপ্লেট টগল', icon: Power },
          { key: 'broadcast' as const, label: 'ব্রডকাস্ট', icon: Radio },
        ]).map((tab) => (
          <Button
            key={tab.key}
            variant={activeSection === tab.key ? 'default' : 'outline'}
            size="sm"
            className={`whitespace-nowrap ${activeSection === tab.key ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            onClick={() => setActiveSection(tab.key)}
          >
            <tab.icon className="w-4 h-4 mr-1.5" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ─── Section: API Configuration ─── */}
      {activeSection === 'config' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <SolidCard>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Key className="w-4 h-4" />
              WhatsApp Cloud API Credentials
            </h3>
            <div className="space-y-4">
              {WA_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label className="text-xs font-medium mb-1.5 block">
                    {field.label}
                  </Label>
                  <div className="relative">
                    <Input
                      type={field.key === 'wa_access_token' && !showToken ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={settings[field.key] || ''}
                      onChange={(e) => setSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="pr-10 text-sm"
                    />
                    {field.key === 'wa_access_token' && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                </div>
              ))}
            </div>

            {/* Save button */}
            <div className="mt-5 flex items-center gap-3">
              <Button
                onClick={saveSettings}
                disabled={savingSettings}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {savingSettings ? <LoadingAnimation className="w-4 h-4" /> : <Save className="w-4 h-4 mr-1.5" />}
                সেভ করুন
              </Button>
            </div>
          </SolidCard>

          {/* Test Message */}
          <SolidCard className="mt-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TestTube className="w-4 h-4" />
              টেস্ট মেসেজ
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="01XXXXXXXXX"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="sm:max-w-[200px] text-sm"
              />
              <Button
                onClick={sendTest}
                disabled={testSending || !testPhone.trim()}
                variant="outline"
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
              >
                {testSending ? <LoadingAnimation className="w-4 h-4" /> : <Send className="w-4 h-4 mr-1.5" />}
                টেস্ট পাঠান
              </Button>
            </div>
          </SolidCard>
        </motion.div>
      )}

      {/* ─── Section: Template Toggles ─── */}
      {activeSection === 'templates' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <SolidCard>
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Power className="w-4 h-4" />
              WhatsApp Notification Templates
            </h3>
            <p className="text-xs text-muted-foreground mb-4">ডিল ইভেন্টে কোন টেমপ্লেট WhatsApp এ পাঠানো হবে তা নিয়ন্ত্রণ করুন।</p>
            <div className="space-y-1">
              {WA_TEMPLATES.map((tmpl) => {
                const isOff = disabledTemplates[tmpl.type] ?? false;
                return (
                  <div
                    key={tmpl.type}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg flex-shrink-0">{tmpl.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tmpl.label}</p>
                        <p className="text-xs text-muted-foreground">{tmpl.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {isOff ? 'বন্ধ' : 'চালু'}
                      </span>
                      <Switch
                        checked={!isOff}
                        onCheckedChange={(checked) =>
                          setDisabledTemplates((prev) => ({ ...prev, [tmpl.type]: !checked }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Button
                onClick={saveSettings}
                disabled={savingSettings || !hasChanges}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {savingSettings ? <LoadingAnimation className="w-4 h-4" /> : <Save className="w-4 h-4 mr-1.5" />}
                সেভ করুন
              </Button>
              {hasChanges && (
                <span className="text-xs text-amber-600">পরিবর্তন আছে</span>
              )}
            </div>
          </SolidCard>
        </motion.div>
      )}

      {/* ─── Section: Broadcast ─── */}
      {activeSection === 'broadcast' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <SolidCard>
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Radio className="w-4 h-4" />
              WhatsApp ব্রডকাস্ট
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              <Users className="w-3 h-3 inline mr-1" />
              সকল সক্রিয় ইউজারের WhatsApp এ মেসেজ পাঠান (সর্বোচ্চ ৫০০ জন)।
            </p>
            <Textarea
              placeholder="আপনার মেসেজ লিখুন... (বাংলা বা English)"
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              rows={4}
              className="text-sm resize-none"
              maxLength={4096}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">
                {broadcastMsg.length}/4096
              </span>
              <Button
                onClick={sendBroadcast}
                disabled={broadcastSending || !broadcastMsg.trim() || !isConfigured}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {broadcastSending ? <LoadingAnimation className="w-4 h-4" /> : <Send className="w-4 h-4 mr-1.5" />}
                ব্রডকাস্ট পাঠান
              </Button>
            </div>

            {/* Broadcast Result */}
            {broadcastResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-muted/50 border space-y-2"
              >
                <p className="text-sm font-medium">ব্রডকাস্ট ফলাফল:</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{broadcastResult.total}</p>
                    <p className="text-xs text-muted-foreground">মোট</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{broadcastResult.sent}</p>
                    <p className="text-xs text-muted-foreground">সফল</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{broadcastResult.failed}</p>
                    <p className="text-xs text-muted-foreground">ব্যর্থ</p>
                  </div>
                </div>
              </motion.div>
            )}
          </SolidCard>
        </motion.div>
      )}
    </div>
  );
}
