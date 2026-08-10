'use client';
import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useT } from '@/lib/i18n';

import { useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Mail, Phone, KeyRound, Eye, EyeOff, Save, UserCircle } from 'lucide-react';

const emptySubscribe = () => () => {};

export function AdminProfilePanel() {
  const t = useT();
  const { user, setUser } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [saving, setSaving] = useState<'email' | 'phone' | 'password' | null>(null);
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  if (!mounted || !user) return null;

  const handleSaveEmail = async () => {
    if (!email.trim()) return;
    setSaving('email');
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_email', email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setUser({ ...user, email: email.trim() });
      } else {
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setSaving(null);
    }
  };

  const handleSavePhone = async () => {
    if (!phone.trim()) return;
    setSaving('phone');
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_phone', phone: phone.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setUser({ ...user, phone: phone.trim() });
      } else {
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setSaving(null);
    }
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setSaving('password');
    try {
      const res = await fetch('/api/admin/profile', {
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
        toast.error(data.error || t('common.failed'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-primary" />
          {t('admin.profile.title')}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t('admin.profile.subtitle')}
        </p>
      </div>

      {/* Avatar + Name */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-base font-bold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {user.adminRole === 'super_admin' ? t('admin.profile.superAdmin') : t('admin.profile.supportAdmin')}
            </p>
          </div>
        </div>
      </div>

      {/* Change Email */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('admin.profile.changeEmail')}</h3>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 text-sm rounded-xl flex-1"
            disabled={saving === 'email'}
            placeholder={t('admin.profile.newEmail')}
          />
          <Button
            size="sm"
            disabled={saving === 'email' || email === user.email || !email.trim()}
            onClick={handleSaveEmail}
            className="h-11 gap-1.5 rounded-xl text-xs font-semibold shrink-0 px-4"
          >
            {saving === 'email' ? <LoadingAnimation size="sm" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* Change Phone */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('admin.profile.changePhone')}</h3>
        </div>
        <div className="flex gap-2">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 text-sm rounded-xl flex-1 font-mono"
            disabled={saving === 'phone'}
            placeholder={t('admin.profile.newPhone')}
          />
          <Button
            size="sm"
            disabled={saving === 'phone' || phone === user.phone || !phone.trim()}
            onClick={handleSavePhone}
            className="h-11 gap-1.5 rounded-xl text-xs font-semibold shrink-0 px-4"
          >
            {saving === 'phone' ? <LoadingAnimation size="sm" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('admin.profile.changePassword')}</h3>
        </div>
        <div className="space-y-2.5">
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              placeholder={t('admin.profile.currentPassword')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-11 text-sm rounded-xl pr-10"
              disabled={saving === 'password'}
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
              placeholder={t('admin.profile.newPasswordMin4')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && currentPassword && newPassword) handleSavePassword(); }}
              className="h-11 text-sm rounded-xl pr-10"
              disabled={saving === 'password'}
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
            disabled={saving === 'password' || !currentPassword || !newPassword || newPassword.length < 4}
            onClick={handleSavePassword}
          >
            {saving === 'password' ? <LoadingAnimation size="sm" /> : <KeyRound className="h-4 w-4" />}
            {t('admin.profile.changePasswordBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
