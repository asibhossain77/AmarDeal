'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore, type DealInfo } from '@/lib/store'
import { useSocket } from '@/hooks/use-socket'

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  dealId?: string | null
  relatedType?: string | null
  relatedId?: string | null
  createdAt: string
}

/**
 * Shared notification state hook — powers the header bell, the
 * /notifications page and the dashboard "Recent Notifications" card.
 *
 * Data flow:
 *  1. Initial fetch of the latest notifications + unread count
 *  2. Real-time updates via the WebSocket service (when reachable)
 *  3. Fallback polling of a lightweight ?count=1 endpoint every 45 s and on
 *     window focus — the socket service is not available on serverless
 *     (Vercel) deployments, so polling keeps the badge honest everywhere.
 */
export function useNotifications() {
  const user = useAppStore((s) => s.user)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { onNotification, isConnected } = useSocket(user?.id)

  /** Full refresh — latest list + unread count */
  const refresh = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      /* silent — analytics-grade niceness must never break UX */
    }
  }, [user?.id])

  // 1. Initial load (loading defaults to true; cleared after the fetch)
  useEffect(() => {
    let active = true
    async function load() {
      if (!user?.id || !active) return
      await refresh()
      if (active) setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [user?.id, refresh])

  // 2. Real-time socket notifications
  useEffect(() => {
    if (!user?.id) return
    const unsub = onNotification((n) => {
      setNotifications((prev) => [
        {
          id: n.id || `ws-${Date.now()}`,
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

  // 3. Fallback polling (badge-only, 45 s) + refresh on window focus
  useEffect(() => {
    if (!user?.id) return
    let active = true

    async function pollCount() {
      if (!active || document.hidden) return
      try {
        const res = await fetch('/api/notifications?count=1')
        if (!res.ok) return
        const data = await res.json()
        if (!active) return
        const serverCount = data.unreadCount || 0
        setUnreadCount((prev) => {
          if (serverCount !== prev) {
            // badge drifted → sync the list too (fire and forget)
            void refresh()
          }
          return serverCount
        })
      } catch {
        /* silent */
      }
    }

    function onVisible() {
      if (!document.hidden) {
        void pollCount()
      }
    }

    const interval = setInterval(pollCount, 45_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [user?.id, refresh])

  /** Mark a single notification as read (optimistic) */
  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id)
      if (!target || target.read) return prev
      setUnreadCount((c) => Math.max(0, c - 1))
      return prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    })
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    } catch {
      /* silent */
    }
  }, [])

  /** Mark every notification as read (optimistic) */
  const markAllRead = useCallback(async () => {
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications/all-read', { method: 'PUT' })
    } catch {
      /* silent */
    }
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    refresh,
    markRead,
    markAllRead,
  }
}

/**
 * Navigate to the target of a notification.
 *  - deal notifications open the deal detail inside the dashboard SPA
 *    (no full reload when already in the SPA)
 *  - anything else lands on the dashboard overview
 * Related deal ids are validated server-side on every deal API call
 * (requireDealAccess), so a forged link cannot expose another user's deal.
 */
export function navigateToNotification(n: Pick<NotificationItem, 'dealId' | 'relatedType'>) {
  if (typeof window === 'undefined') return
  if (n.dealId) {
    const state = useAppStore.getState()
    if (state.view === 'dashboard') {
      // Minimal deal info — DealWorkflowTracker fetches the full record by id
      // (same pattern as the /dashboard/deals/:id deep link in url-sync).
      state.setActiveDeal({ id: n.dealId } as DealInfo)
      state.setDashboardPanel('deal-detail')
    } else {
      // Static route (/notifications) → real navigation into the SPA
      window.location.href = `/dashboard/deals/${n.dealId}`
    }
    return
  }
  const state = useAppStore.getState()
  if (state.view === 'dashboard') {
    state.setDashboardPanel('overview')
  } else {
    window.location.href = '/dashboard'
  }
}
