'use client';

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, Shield, Crown, Store, Camera, X, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { cdnUrl } from '@/lib/cdn-url';

const emptySubscribe = () => () => {};

export function ProfilePanel() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const fileInputId = 'profile-pic-upload';

  const currentImage = user?.imageLink || null;

  // Preload image and track load state
  useEffect(() => {
    setImgLoaded(false);
    if (!currentImage) return;
    const img = new Image();
    img.onload = () => {
      console.log('[Profile] Image preloaded OK:', currentImage);
      setImgLoaded(true);
    };
    img.onerror = () => {
      console.error('[Profile] Image preload FAILED:', currentImage);
      setImgLoaded(false);
    };
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
      // Send the current image so the server deletes the old file from R2
      if (user?.imageLink) fd.append('oldImage', user.imageLink);
      const res = await fetch('/api/upload/profile-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        // Persist the new URL to the DB, otherwise the image is lost on refresh
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

  const showImage = currentImage && imgLoaded;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('profile.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-6 space-y-6">
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
          <div>
            <h3 className="text-lg font-bold text-foreground">{user?.name || t('dashboard.user')}</h3>
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
