'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Bell,
  BellOff,
  CheckCheck,
  X,
  ClipboardList,
  FilePlus2,
  CheckCircle2,
  Truck,
  XCircle,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  Scale,
  MessageSquare,
  Store,
  BadgeCheck,
  Info,
  Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n'
import { useNotifications, navigateToNotification, type NotificationItem } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

/** Locale-aware relative time with English digits */
export function timeAgo(dateStr: string, locale: 'bn' | 'en'): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (locale === 'en') {
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }
  if (mins < 1) return 'এইমাত্র'
  if (mins < 60) return `${mins} মিনিট আগে`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ঘণ্টা আগে`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} দিন আগে`
  return `${Math.floor(days / 30)} মাস আগে`
}

type IconComponent = React.ComponentType<{ className?: string }>

interface TypeStyle {
  icon: IconComponent
  color: string
}

/** Lucide icon + color chip per notification type (no emojis) */
const TYPE_STYLES: Record<string, TypeStyle> = {
  deal_request: { icon: ClipboardList, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  deal_created: { icon: FilePlus2, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  deal_accepted: { icon: CheckCircle2, color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  deal_status_updated: { icon: Truck, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  delivery_started: { icon: Truck, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  deal_completed: { icon: BadgeCheck, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  deal_cancelled: { icon: XCircle, color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
  payment_pending: { icon: Wallet, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
  payment_submitted: { icon: Wallet, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
  payment_verified: { icon: ShieldCheck, color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  deal_disputed: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
  dispute_opened: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
  dispute_resolved: { icon: Scale, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  new_message: { icon: MessageSquare, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400' },
  seller_request: { icon: Store, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
  seller_approved: { icon: Store, color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  seller_rejected: { icon: Store, color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
  system_update: { icon: Info, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400' },
  payout: { icon: Banknote, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
  system: { icon: Bell, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400' },
}

const FALLBACK_STYLE: TypeStyle = TYPE_STYLES.system

export function NotificationIcon({ type }: { type: string }) {
  const { icon: Icon, color } = TYPE_STYLES[type] || FALLBACK_STYLE
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', color)}>
      <Icon className="h-4 w-4" />
    </span>
  )
}

export function NotificationBell() {
  const user = useAppStore((s) => s.user)
  const locale = useAppStore((s) => s.locale)
  const { t } = useTranslation(locale)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
  } = useNotifications()

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

  /** Click a notification: auto mark-read + open the related deal/chat */
  const handleOpen = (n: NotificationItem) => {
    if (!n.read) markRead(n.id)
    setOpen(false)
    navigateToNotification(n)
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
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {unreadCount} {t('notif.unreadCount')}
                  </span>
                )}
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
                      onClick={() => handleOpen(n)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-border/30 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                        !n.read && 'bg-primary/[0.04]'
                      )}
                    >
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'truncate text-sm font-medium text-foreground',
                            !n.read && 'font-semibold'
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
                          {timeAgo(n.createdAt, locale)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer — View All */}
            <div className="border-t border-border/50 px-4 py-2.5">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
              >
                {t('notif.viewAll')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
