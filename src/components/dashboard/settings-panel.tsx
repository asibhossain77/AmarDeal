'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sun, Moon, LogOut, ShieldCheck, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const emptySubscribe = () => () => {};

export function SettingsPanel() {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!mounted) return null;

  const handleLogout = () => {
    logout();
    toast.success('সফলভাবে লগআউট হয়েছে');
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
        toast.error(data.error || 'ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="text-center lg:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">সেটিংস</h2>
        <p className="mt-1 text-sm text-muted-foreground">আপনার পছন্দ ও অ্যাকাউন্ট সেটিংস</p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Theme Toggle */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">থিম</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-amber-500" />}
              <span className="text-sm font-medium text-foreground">
                {theme === 'dark' ? 'ডার্ক মোড' : 'লাইট মোড'}
              </span>
            </div>
            <Button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              variant="outline"
              className="rounded-xl text-xs font-semibold"
            >
              {theme === 'dark' ? 'লাইটে পরিবর্তন' : 'ডার্কে পরিবর্তন'}
            </Button>
          </div>
        </div>

        {/* Password Change */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">পাসওয়ার্ড পরিবর্তন</h3>
          </div>
          <div className="space-y-2.5">
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                placeholder="বর্তমান পাসওয়ার্ড"
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
                placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৪ অক্ষর)"
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
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              পাসওয়ার্ড পরিবর্তন করুন
            </Button>
          </div>
        </div>

        {/* Security Info */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">নিরাপত্তা</h3>
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 border border-emerald-200 dark:border-emerald-500/20">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">এসক্রো সুরক্ষা সক্রিয়</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">সকল ডিল এসক্রো সুরক্ষায় সুরক্ষিত</p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">অ্যাকাউন্ট</h3>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-11 rounded-xl text-sm font-semibold gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            লগআউট
          </Button>
        </div>
      </div>
    </motion.div>
  );
}