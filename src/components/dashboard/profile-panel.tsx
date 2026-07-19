'use client';

import { useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Shield, Crown, Store } from 'lucide-react';
import { useT } from '@/lib/i18n';

const emptySubscribe = () => () => {};

export function ProfilePanel() {
  const user = useAppStore((s) => s.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();

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

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="text-center lg:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('profile.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-3xl font-bold text-primary">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-foreground">{user?.name || t('dashboard.user')}</h3>
            <Badge className={`${roleBadgeClass} border-0 font-medium mt-1`}>{roleLabel}</Badge>
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