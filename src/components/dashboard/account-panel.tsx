'use client';

/* ═══════════════════════════════════════════════════════════════
   AccountPanel — the unified Account page (renamed from Profile).
   One dashboard panel with internal tabs instead of separate
   sidebar pages:
     1. Profile Info   — avatar, identity, editable name/phone
     2. Account Settings — password change + theme/language/push
     3. Seller Request — inline seller application (no modal)
   Reuses the existing /api/user/profile actions (change_password,
   update_image_link, update_info) and the seller application APIs.
   The legacy /dashboard/settings deep-link renders this panel with
   the settings tab preselected — no navigation is broken.
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User, Mail, Phone, Shield, Crown, Store, Camera, X, Loader2,
  UserCircle, Settings, KeyRound, Eye, EyeOff, Lock, Check,
  Sun, Moon, Globe, Bell, BellOff, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cdnUrl } from '@/lib/cdn-url';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { requestPushSubscription, unsubscribePush } from '@/hooks/use-push-subscription';
import { SellerRequestSection } from './seller-request-section';

const emptySubscribe = () => () => {};

export type AccountTab = 'profile' | 'settings' | 'seller';

/* ═══════════════ Tab 1: Profile Info ═══════════════ */

function ProfileInfoTab() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const t = useT();

  // Avatar upload (logic carried over from the legacy ProfilePanel)
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const fileInputId = 'account-pic-upload';
  const currentImage = user?.imageLink || null;

  useEffect(() => {
    setImgLoaded(false);
    if (!currentImage) return;
    const img = new Image();
    img.onload = () => setImgLoaded(true);
    img.onerror = () => setImgLoaded(false);
    img.src = cdnUrl(currentImage) || '';
  }, [currentImage]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('ছবি সর্বোচ্চ 2MB হতে পারে');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (user?.imageLink) fd.append('oldImage', user.imageLink);
      const res = await fetch('/api/upload/profile-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        const saveRes = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_image_link', imageLink: data.url }),
        });
        const saveData = await saveRes.json().catch(() => ({}));
        if (saveRes.ok && saveData.success) {
          if (user) setUser({ ...user, imageLink: data.url });
          toast.success('প্রোফাইল ছবি আপডেট হয়েছে!');
        } else {
          toast.error(saveData.error || 'ছবি সেভ করা যায়নি — আবার চেষ্টা করুন');
        }
      } else {
        toast.error(data.error || 'আপলোড ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setUploading(false);
      const inp = document.getElementById(fileInputId) as HTMLInputElement | null;
      if (inp) inp.value = '';
    }
  };

  const handleRemoveImage = async () => {
    setRemoving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_image_link', imageLink: '' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('প্রোফাইল ছবি সরানো হয়েছে!');
        if (user) setUser({ ...user, imageLink: null });
      } else {
        toast.error(data.error || 'সরাতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setRemoving(false);
    }
  };

  // Editable permitted info (name / phone)
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingInfo, setSavingInfo] = useState(false);
  // Re-sync the editable fields when the store user changes (e.g. after save)
  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
  }, [user?.id]);

  const infoDirty = name.trim() !== (user?.name || '') || phone.trim() !== (user?.phone || '');

  const handleSaveInfo = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      toast.error('নাম কমপক্ষে ২ অক্ষর এবং সর্বোচ্চ ৬০ অক্ষরের হতে হবে');
      return;
    }
    if (trimmedPhone && !/^[+]?[0-9\s-]{6,20}$/.test(trimmedPhone)) {
      toast.error('সঠিক ফোন নম্বর দিন');
      return;
    }
    setSavingInfo(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_info', name: trimmedName, phone: trimmedPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (user) setUser({ ...user, name: data.user.name, phone: data.user.phone });
        toast.success(t('account.infoUpdated'));
      } else {
        toast.error(data.error || t('settings.failed'));
      }
    } catch {
      toast.error(t('settings.serverError'));
    } finally {
      setSavingInfo(false);
    }
  };

  /* Role label & badge (carried over from the legacy ProfilePanel) */
  let roleLabel = t('profile.roleUser');
  let roleBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400';
  let RoleIcon = Shield;

  if (user?.isAdmin) {
    roleLabel = user.adminRole === 'super_admin' ? t('profile.roleSuperAdmin') : t('profile.roleSupportAdmin');
    roleBadgeClass = 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400';
    RoleIcon = Crown;
  } else if (user?.isSeller) {
    roleLabel = t('profile.roleSeller');
    roleBadgeClass = 'bg-primary/15 text-primary dark:bg-primary/15';
    RoleIcon = Store;
  }

  const showImage = currentImage && imgLoaded;

  return (
    <div className="space-y-6">
      <div className="w-full rounded-2xl bg-white dark:bg-card shadow-lg p-6 space-y-6">
        {/* Avatar with upload */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <label
              htmlFor={fileInputId}
              className="block h-16 w-16 sm:h-20 sm:w-20 rounded-full cursor-pointer ring-3 ring-primary/20 overflow-hidden"
              style={showImage
                ? { backgroundImage: `url(${cdnUrl(currentImage) || ''})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { backgroundColor: 'oklch(0.768 0.189 131 / 0.15)' }
              }
            >
              {!showImage && (
                <span className="flex h-full w-full items-center justify-center text-2xl sm:text-3xl font-bold select-none"
                  style={{ color: 'oklch(0.768 0.189 131)' }}
                >
                  {user?.name?.charAt(0) || 'U'}
                </span>
              )}
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </span>
              )}
              {!uploading && showImage && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors">
                  <Camera className="h-5 w-5 text-white opacity-0 hover:opacity-100 transition-opacity" />
                </span>
              )}
              <span className="sr-only">ছবি আপলোড করুন</span>
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground truncate">{user?.name || t('dashboard.user')}</h3>
            <Badge className={`${roleBadgeClass} border-0 font-medium mt-1`}>{roleLabel}</Badge>
            <div className="flex gap-2 mt-2">
              <label htmlFor={fileInputId}>
                <span
                  className="inline-flex items-center h-8 px-3 text-xs rounded-lg gap-1.5 border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  style={uploading ? { pointerEvents: 'none', opacity: 0.5 } : {}}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {uploading ? 'আপলোড হচ্ছে...' : 'ছবি পরিবর্তন'}
                </span>
              </label>
              {currentImage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs rounded-lg gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  onClick={handleRemoveImage}
                  disabled={removing}
                >
                  {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3" />}
                  সরান
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Editable permitted info */}
        <div className="rounded-2xl border border-border/60 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-foreground">{t('account.editInfoTitle')}</h4>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t('account.editInfoDesc')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-name" className="text-xs font-semibold text-muted-foreground">{t('profile.name')}</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('account.namePh')}
                className="h-11 rounded-xl text-sm"
                maxLength={60}
                disabled={savingInfo}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-phone" className="text-xs font-semibold text-muted-foreground">{t('profile.phone')}</Label>
              <Input
                id="account-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('account.phonePh')}
                className="h-11 rounded-xl text-sm"
                dir="ltr"
                disabled={savingInfo}
              />
            </div>
          </div>
          <Button
            onClick={handleSaveInfo}
            disabled={savingInfo || !infoDirty}
            className="w-full sm:w-auto h-10 rounded-xl text-sm font-bold gap-2 px-6"
          >
            {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {savingInfo ? t('account.saving') : t('account.saveInfo')}
          </Button>
        </div>

        {/* Read-only identity fields */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#84CC1620', color: '#84CC16' }}>
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{t('profile.email')}</p>
              <p className="text-sm font-bold truncate text-foreground">{user?.email || '---'}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              {t('account.emailLocked')}
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#84CC1620', color: '#84CC16' }}>
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('profile.name')}</p>
              <p className="text-sm font-bold truncate text-foreground">{user?.name || '---'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#84CC1620', color: '#84CC16' }}>
              <RoleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('profile.accountId')}</p>
              <p className="text-sm font-bold font-mono truncate text-foreground">{user?.id ? user.id.slice(0, 12) + '...' : '---'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Tab 2: Account Settings ═══════════════ */
/* Carried over from the legacy SettingsPanel (theme, language, push,
   password change) so the sidebar item could be removed without
   losing any functionality. */

function SettingsTab() {
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const { theme, setTheme } = useTheme();
  const t = useT();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushLoading, setPushLoading] = useState(false);

  // Check current push permission/subscription status
  useEffect(() => {
    async function checkPush() {
      if (!('Notification' in window)) {
        setPushEnabled(false);
        return;
      }
      const perm = Notification.permission;
      if (perm === 'denied') {
        setPushEnabled(false);
        return;
      }
      if (perm === 'granted' && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setPushEnabled(!!sub);
        } catch {
          setPushEnabled(false);
        }
        return;
      }
      setPushEnabled(false);
    }
    checkPush();
  }, []);

  const handlePushToggle = useCallback(async () => {
    if (!user?.id) return;
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribePush();
        setPushEnabled(false);
        toast.success(t('notif.pushDisabled'));
      } else {
        const ok = await requestPushSubscription(user.id);
        if (ok) {
          setPushEnabled(true);
          toast.success(t('notif.pushEnabled'));
        } else {
          toast.error(t('notif.pushFailed'));
        }
      }
    } catch {
      toast.error(t('notif.pushFailed'));
    } finally {
      setPushLoading(false);
    }
  }, [pushEnabled, user?.id, t]);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 8) {
      toast.error('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');
      return;
    }
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
    <div className="w-full space-y-4">
      {/* Password Change */}
      <div className="rounded-2xl bg-white dark:bg-card shadow-lg p-5 space-y-3">
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
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="toggle password visibility"
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
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="toggle password visibility"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            className="w-full h-11 rounded-xl text-sm font-bold gap-2"
            disabled={saving || !currentPassword || !newPassword || newPassword.length < 8}
            onClick={handleChangePassword}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {t('settings.changePassword')}
          </Button>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="rounded-2xl bg-white dark:bg-card shadow-lg p-5">
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
      <div className="rounded-2xl bg-white dark:bg-card shadow-lg p-5">
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
      <div className="rounded-2xl bg-white dark:bg-card shadow-lg p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {pushEnabled ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('notif.pushTitle')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('notif.pushSubtitle')}</p>
            </div>
          </div>
          <Button
            onClick={handlePushToggle}
            variant={pushEnabled ? 'default' : 'outline'}
            className="rounded-xl text-xs font-semibold"
            disabled={pushLoading || pushEnabled === null}
          >
            {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pushEnabled ? t('notif.pushOn') : t('notif.pushOff')}
          </Button>
        </div>
      </div>

      {/* Security Info */}
      <div className="rounded-2xl bg-white dark:bg-card shadow-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t('settings.security')}</h3>
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 border border-emerald-200 dark:border-emerald-500/20">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('settings.escrowActive')}</p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{t('settings.escrowActiveDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Tab 3: Seller Request ═══════════════ */

function SellerRequestTab() {
  const t = useT();
  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Store className="h-4 w-4 text-primary" />
          {t('account.sellerTitle')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('account.sellerDesc')}</p>
      </div>
      <div className="w-full rounded-2xl bg-white dark:bg-card shadow-lg p-5 sm:p-6">
        <SellerRequestSection />
      </div>
    </div>
  );
}

/* ═══════════════ Main Account Panel ═══════════════ */

export function AccountPanel({ initialTab = 'profile' }: { initialTab?: AccountTab }) {
  const user = useAppStore((s) => s.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();
  const [tab, setTab] = useState<AccountTab>(initialTab);

  // Seller Request tab is meaningless for admins (they manage seller
  // applications from the Admin Panel) — mirrors the legacy sidebar rule
  const showSellerTab = !user?.isAdmin;
  const activeTab: AccountTab = tab === 'seller' && !showSellerTab ? 'profile' : tab;

  if (!mounted) return null;

  const tabs: { id: AccountTab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: t('account.tabProfile'), icon: UserCircle },
    { id: 'settings', label: t('account.tabSettings'), icon: Settings },
    ...(showSellerTab ? [{ id: 'seller' as AccountTab, label: t('account.tabSeller'), icon: Store }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('profile.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      {/* Internal section tabs — no separate sidebar pages */}
      <div
        role="tablist"
        aria-label={t('profile.title')}
        className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border/60 bg-muted/40 dark:bg-card/60 p-1.5"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item.id)}
              className={`flex flex-1 min-w-fit items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white dark:bg-card shadow-sm text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && <ProfileInfoTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'seller' && <SellerRequestTab />}
    </motion.div>
  );
}
