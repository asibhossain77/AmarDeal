'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useEffect, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useAppStore } from '@/lib/store';
import { useTranslation, type Locale } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sun, Moon, LogOut, ShieldCheck, KeyRound, Eye, EyeOff, Globe, Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const emptySubscribe = () => () => {};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function SettingsPanel() {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const locale = useAppStore((s) => s.locale);
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation(locale);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushAction, setPushAction] = useState(false);
  const [pushDiag, setPushDiag] = useState<Record<string, unknown> | null>(null);

  // Push notification functions
  const isPushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const checkPushStatus = async () => {
    if (!isPushSupported) { setPushLoading(false); return; }
    try {
      const res = await fetch('/api/push/status');
      const data = await res.json();
      setPushEnabled(data.enabled);
      setPushDiag(data.diagnostics || null);
      console.log('[Settings] Push diagnostics:', data);
    } catch { /* ignore */ }
    setPushLoading(false);
  };

  useEffect(() => { void checkPushStatus(); }, []);

  const togglePush = async () => {
    if (!isPushSupported) {
      toast.error(t('settings.pushNotSupported'));
      return;
    }
    setPushAction(true);
    try {
      if (pushEnabled) {
        // Disable
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setPushEnabled(false);
        toast.success(t('settings.pushOffSuccess'));
      } else {
        // Enable
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error(t('settings.pushDenied'));
          setPushAction(false);
          return;
        }
        const statusRes = await fetch('/api/push/status');
        const statusData = await statusRes.json();
        if (!statusData.vapidKey) {
          toast.error(t('settings.serverError'));
          setPushAction(false);
          return;
        }
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(statusData.vapidKey),
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: sub.toJSON().keys,
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const d = await r.json().catch(() => ({}));
            throw new Error(d.error || 'Subscribe failed');
          }
        });
        setPushEnabled(true);
        toast.success(t('settings.pushSuccess'));
      }
    } catch (err) {
      console.error('[Push Toggle]', err);
      toast.error(t('settings.serverError'));
    }
    setPushAction(false);
  };

  const sendTestPush = async () => {
    if (!user) return;
    setPushAction(true);
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: locale === 'bn' ? '🔔 টেস্ট নোটিফিকেশন' : '🔔 Test Notification',
          message: locale === 'bn' ? 'পুশ নোটিফিকেশন সফলভাবে কাজ করছে!' : 'Push notifications are working!',
          url: '/',
        }),
      });
      toast.success(t('settings.pushTestSent'));
    } catch {
      toast.error(t('settings.serverError'));
    }
    setPushAction(false);
  };

  if (!mounted) return null;

  const handleLogout = () => {
    logout();
    toast.success(t('settings.logoutSuccess'));
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setCurrentPassword('');
        setNewPassword('');
      } else {
        toast.error(data.error || t('settings.failed'));
      }
    } catch {
      toast.error(t('settings.serverError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('settings.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="w-full space-y-4">
        {/* Theme Toggle */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('settings.theme')}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-amber-500" />}
              <span className="text-sm font-medium text-foreground">
                {theme === 'dark' ? t('settings.darkMode') : t('settings.lightMode')}
              </span>
            </div>
            <Button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              variant="outline"
              className="rounded-xl text-xs font-semibold"
            >
              {theme === 'dark' ? t('settings.switchToLight') : t('settings.switchToDark')}
            </Button>
          </div>
        </div>

        {/* Language Preference */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t('settings.language')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t('settings.languageSubtitle')}</p>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </div>

        {/* Push Notifications */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">{t('settings.pushNotifications')}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t('settings.pushDesc')}</p>
          {pushLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>...</span>
            </div>
          ) : !isPushSupported ? (
            <p className="text-xs text-muted-foreground">{t('settings.pushNotSupported')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {pushEnabled ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Bell className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <BellOff className="h-4 w-4" />
                    </div>
                  )}
                  <span className="text-sm font-medium">
                    {pushEnabled ? t('settings.pushEnabled') : t('settings.pushDisabled')}
                  </span>
                </div>
                <Button
                  onClick={togglePush}
                  variant={pushEnabled ? 'outline' : 'default'}
                  size="sm"
                  className="rounded-xl text-xs font-semibold gap-1.5"
                  disabled={pushAction}
                >
                  {pushAction && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {pushEnabled ? t('settings.pushDisable') : t('settings.pushEnable')}
                </Button>
              </div>
              {pushEnabled && (
                <Button
                  onClick={sendTestPush}
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl text-xs font-medium gap-1.5"
                  disabled={pushAction}
                >
                  {pushAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                  {t('settings.pushTest')}
                </Button>
              )}
              {/* Diagnostics */}
              {pushDiag && (
                <div className="mt-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-2.5 text-[11px] text-muted-foreground font-mono space-y-0.5">
                  <div className="flex justify-between"><span>Browser:</span><span className={isPushSupported ? 'text-emerald-500' : 'text-red-500'}>{isPushSupported ? 'Supported' : 'Not supported'}</span></div>
                  <div className="flex justify-between"><span>Permission:</span><span>{typeof window !== 'undefined' ? Notification.permission : 'N/A'}</span></div>
                  <div className="flex justify-between"><span>VAPID:</span><span className={pushDiag.vapidConfigured ? 'text-emerald-500' : 'text-red-500'}>{pushDiag.vapidConfigured ? 'OK' : 'NOT SET'}</span></div>
                  <div className="flex justify-between"><span>DB:</span><span className={pushDiag.dbWorking !== false ? 'text-emerald-500' : 'text-red-500'}>{pushDiag.dbWorking !== false ? 'Connected' : 'Error'}</span></div>
                  <div className="flex justify-between"><span>Your subs:</span><span>{String(pushDiag.userSubCount ?? '-')}</span></div>
                  <div className="flex justify-between"><span>Total subs:</span><span>{String(pushDiag.totalSubscriptions ?? '-')}</span></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Change */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{t('settings.passwordChange')}</h3>
          </div>
          <div className="space-y-2.5">
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                placeholder={t('settings.currentPassword')}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-11 text-sm rounded-xl pr-10"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                placeholder={t('settings.newPassword')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && currentPassword && newPassword) handleChangePassword(); }}
                className="h-11 text-sm rounded-xl pr-10"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              className="w-full h-11 rounded-xl text-sm font-bold gap-2"
              disabled={saving || !currentPassword || !newPassword || newPassword.length < 4}
              onClick={handleChangePassword}
            >
              {saving ? <LoadingAnimation size="sm" /> : <KeyRound className="h-4 w-4" />}
              {t('settings.changePassword')}
            </Button>
          </div>
        </div>

        {/* Security Info */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('settings.security')}</h3>
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 border border-emerald-200 dark:border-emerald-500/20">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('settings.escrowActive')}</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{t('settings.escrowActiveDesc')}</p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('settings.account')}</h3>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-11 rounded-xl text-sm font-semibold gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}