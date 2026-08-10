'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useSyncExternalStore, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Shield, Crown, Store, Camera, Check, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';

const emptySubscribe = () => () => {};

export function ProfilePanel() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

  const [imageLink, setImageLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync current user's imageLink on mount / user change
  useEffect(() => {
    if (user?.imageLink) {
      setImageLink(user.imageLink);
      setPreviewUrl(user.imageLink);
    } else {
      setImageLink('');
      setPreviewUrl(null);
    }
  }, [user?.imageLink]);

  // Debounced preview
  const handleImageLinkChange = (val: string) => {
    setImageLink(val);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    if (!val.trim()) {
      setPreviewUrl(null);
      return;
    }
    previewTimerRef.current = setTimeout(() => {
      setPreviewUrl(val.trim());
    }, 600);
  };

  const handleSaveImage = async () => {
    if (!imageLink.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_image_link', imageLink: imageLink.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('প্রোফাইল ছবি আপডেট হয়েছে!');
        // Update store
        if (user) setUser({ ...user, imageLink: imageLink.trim() });
      } else {
        toast.error(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_image_link', imageLink: '' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('প্রোফাইল ছবি সরানো হয়েছে!');
        setImageLink('');
        setPreviewUrl(null);
        if (user) setUser({ ...user, imageLink: null });
      } else {
        toast.error(data.error || 'সরাতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  /* Determine role label & badge from isAdmin / isSeller */
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

  const currentImage = previewUrl || user?.imageLink || null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('profile.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-6 space-y-6">
        {/* Avatar with image */}
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            {currentImage ? (
              <img
                src={currentImage}
                alt={user?.name || 'Profile'}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover ring-3 ring-primary/20"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary/15 text-2xl sm:text-3xl font-bold text-primary">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{user?.name || t('dashboard.user')}</h3>
            <Badge className={`${roleBadgeClass} border-0 font-medium mt-1`}>{roleLabel}</Badge>
          </div>
        </div>

        {/* Profile Image Link Section */}
        <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: '#84CC1620', color: '#84CC16' }}>
              <Camera className="h-4 w-4" />
            </div>
            <Label className="text-sm font-semibold text-foreground">প্রোফাইল ছবি</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-9">ছবির লিংক দিন, আপনার প্রোফাইল ও ডিলে ছবি দেখাবে</p>

          {/* Preview */}
          {previewUrl && (
            <div className="pl-9">
              <div className="relative inline-block rounded-xl overflow-hidden border border-border/30">
                <img
                  src={previewUrl}
                  alt="প্রিভিউ"
                  className="h-24 w-24 rounded-xl object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          )}

          {/* Input + Buttons */}
          <div className="pl-9 flex gap-2">
            <Input
              placeholder="https://example.com/image.jpg"
              value={imageLink}
              onChange={(e) => handleImageLinkChange(e.target.value)}
              className="h-10 rounded-xl text-sm flex-1"
            />
            {user?.imageLink && !imageLink.trim() ? null : (
              <Button
                size="sm"
                className="h-10 px-3 rounded-xl gap-1.5"
                onClick={handleSaveImage}
                disabled={saving || !imageLink.trim() || imageLink.trim() === (user?.imageLink || '')}
              >
                {saving ? <LoadingAnimation size="sm" /> : <Check className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">সেভ</span>
              </Button>
            )}
            {currentImage && (
              <Button
                size="sm"
                variant="outline"
                className="h-10 px-3 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                onClick={handleRemoveImage}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Info fields */}
        <div className="space-y-4">
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
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('profile.email')}</p>
              <p className="text-sm font-bold truncate text-foreground">{user?.email || '---'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#84CC1620', color: '#84CC16' }}>
              <Phone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('profile.phone')}</p>
              <p className="text-sm font-bold truncate text-foreground">{user?.phone || '---'}</p>
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
    </motion.div>
  );
}