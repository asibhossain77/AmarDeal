'use client';

import Link from 'next/link';
import { ArrowUpRight, Bell } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { useNotifications, navigateToNotification } from '@/hooks/use-notifications';
import { NotificationIcon, timeAgo } from '@/components/shared/notification-bell';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

/**
 * Dashboard overview "Recent Notifications" card — latest 5 notifications
 * with icon, title, short message, relative time and unread indicator.
 */
export function RecentNotifications() {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const { notifications, loading, markRead } = useNotifications();

  const recent = notifications.slice(0, 5);

  const handleOpen = (n: (typeof recent)[number]) => {
    if (!n.read) markRead(n.id);
    navigateToNotification(n);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-6"
    >
      <div className="rounded-2xl border border-border/50 bg-card/60 shadow-sm backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t('notif.recent')}
              </h3>
            </div>
          </div>
          <Link
            href="/notifications"
            className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            {t('notif.viewAll')}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* List */}
        {loading && recent.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t('notif.loading')}</span>
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Bell className="h-6 w-6 opacity-30" />
            <p className="text-xs">{t('notif.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {recent.map((n) => (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className={cn(
                  'flex w-full items-start gap-3 border-t border-border/30 px-5 py-3 text-left transition-colors first:border-t-0 hover:bg-accent/40',
                  !n.read && 'bg-primary/[0.03]'
                )}
              >
                <NotificationIcon type={n.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      'truncate text-sm text-foreground',
                      n.read ? 'font-medium' : 'font-semibold'
                    )}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                    {timeAgo(n.createdAt, locale)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
