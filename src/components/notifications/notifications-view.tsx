'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  LogIn,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n'
import {
  useNotifications,
  navigateToNotification,
} from '@/hooks/use-notifications'
import { NotificationIcon, timeAgo } from '@/components/shared/notification-bell'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 30

export function NotificationsView() {
  const user = useAppStore((s) => s.user)
  const locale = useAppStore((s) => s.locale)
  const { t } = useTranslation(locale)
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications()

  // Static route — the SPA session restore in app-shell never runs here, so
  // restore the logged-in user into the store ourselves (no view reset).
  const setUser = useAppStore((s) => s.setUser)
  const storeUser = useAppStore((s) => s.user)
  useEffect(() => {
    if (storeUser) return
    let active = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const u = data?.user || data || null
        if (active && u?.id) setUser(u)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [storeUser, setUser])

  /** Open a notification: mark read + navigate (deal → deal detail/chat) */
  const handleOpen = useCallback(
    (n: (typeof notifications)[number]) => {
      if (!n.read) markRead(n.id)
      navigateToNotification(n)
    },
    [markRead]
  )

  // Not logged in → prompt
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Bell className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{t('notif.loginRequired')}</p>
        <Button onClick={() => router.push('/login')} className="gap-2">
          <LogIn className="h-4 w-4" />
          Login
        </Button>
      </div>
    )
  }

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications
  const shown = filtered.slice(0, visible)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            {t('nav.notifications')}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} ${t('notif.unreadCount')}`
              : t('notif.all')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t('notif.markAllRead')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="gap-1.5"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t('notif.goToDashboard')}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex w-fit rounded-lg border border-border/60 bg-muted/40 p-1">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f)
              setVisible(PAGE_SIZE)
            }}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
              filter === f
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f === 'all' ? t('notif.all') : t('notif.unread')}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t('notif.loading')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 py-20 text-muted-foreground">
          <BellOff className="h-9 w-9 opacity-40" />
          <p className="text-sm">{t('notif.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((n) => (
            <button
              key={n.id}
              onClick={() => handleOpen(n)}
              className={cn(
                'group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md',
                n.read
                  ? 'border-border/50 bg-card hover:border-border'
                  : 'border-primary/25 bg-primary/[0.04] hover:border-primary/40'
              )}
            >
              <NotificationIcon type={n.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn(
                    'text-sm text-foreground',
                    n.read ? 'font-medium' : 'font-semibold'
                  )}>
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {n.message}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                  <span>{timeAgo(n.createdAt, locale)}</span>
                  {n.dealId && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      #{n.dealId.slice(-8)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Load more */}
          {visible < filtered.length && (
            <Button
              variant="ghost"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-2 w-full text-muted-foreground"
            >
              {t('notif.all')} ({filtered.length - visible}+)
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
