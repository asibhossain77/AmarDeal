'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, X, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n'
import { useSocket } from '@/hooks/use-socket'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  dealId?: string
  createdAt: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'এইমাত্র'
  if (mins < 60) return `${mins}মি আগে`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}ঘণ্টা আগে`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}দিন আগে`
  return `${Math.floor(days / 30)}মাস আগে`
}

function NotificationIcon({ type }: { type: string }) {
  const iconClass = 'h-4 w-4'
  const colorMap: Record<string, string> = {
    deal_request: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    deal_accepted: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
    deal_completed: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    deal_cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
    payment_verified: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
    dispute: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
    payout: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
    system: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  }
  const color = colorMap[type] || colorMap.system

  const emojiMap: Record<string, string> = {
    deal_request: '📋',
    deal_accepted: '✅',
    deal_completed: '🎉',
    deal_cancelled: '❌',
    payment_verified: '💰',
    dispute: '⚠️',
    payout: '💸',
    system: '🔔',
  }
  const emoji = emojiMap[type] || emojiMap.system

  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm', color)}>
      {emoji}
    </span>
  )
}

export function NotificationBell() {
  const user = useAppStore((s) => s.user)
  const locale = useAppStore((s) => s.locale)
  const t = useTranslation(locale)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { onNotification } = useSocket(user?.id)

  // Initial fetch
  useEffect(() => {
    let active = true
    async function load() {
      if (!user?.id || !active) return
      setLoading(true)
      try {
        const res = await fetch('/api/notifications')
        const data = await res.json()
        if (active) {
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch { /* silent */ }
      if (active) setLoading(false)
    }
    load()
    return () => { active = false }
  }, [user?.id])

  // Listen for real-time notifications
  useEffect(() => {
    if (!user?.id) return
    const unsub = onNotification((n) => {
      setNotifications((prev) => [
        {
          id: n.id || Date.now().toString(),
          type: n.type,
          title: n.title,
          message: n.message,
          read: false,
          dealId: n.dealId,
          createdAt: n.createdAt || new Date().toISOString(),
        },
        ...prev,
      ])
      setUnreadCount((c) => c + 1)
    })
    return unsub
  }, [user?.id, onNotification])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Mark single as read
  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch { /* silent */ }
  }

  // Mark all as read
  const markAllRead = async () => {
    if (!user?.id) return
    try {
      await fetch('/api/notifications/all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch { /* silent */ }
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground',
          open && 'bg-accent text-foreground'
        )}
        aria-label={t('nav.notifications')}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-xl shadow-black/10 sm:w-96"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('nav.notifications')}
              </h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={markAllRead}
                  >
                    <CheckCheck className="h-3 w-3" />
                    {t('notif.markAllRead')}
                  </Button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <ScrollArea className="h-80">
              {loading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t('notif.loading')}</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                  <BellOff className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t('notif.empty')}</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.read) markRead(n.id)
                      }}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-border/30 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                        !n.read && 'bg-primary/[0.03]'
                      )}
                    >
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'truncate text-sm font-medium text-foreground',
                            !n.read && 'text-foreground'
                          )}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-border/50 px-4 py-2.5">
                <p className="text-center text-[11px] text-muted-foreground/60">
                  {t('notif.hint')}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
