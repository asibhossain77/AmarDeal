'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'

/**
 * Auto-subscribes the logged-in user to push notifications.
 * Call this hook at the top level of the app (e.g., in AppShell).
 * It's a no-op if:
 *  - User is not logged in
 *  - Push is not supported (non-HTTPS, missing service worker)
 *  - Permission was already denied
 */
export function usePushSubscription() {
  const user = useAppStore((s) => s.user)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (!user?.id || subscribedRef.current) return

    async function subscribe() {
      // Check if push is supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      // Check permission
      const permission = await Notification.permission
      if (permission === 'denied') return
      if (permission === 'granted') {
        await doSubscribe(user!.id)
        return
      }

      // Default: don't auto-prompt. The user can enable from settings.
      // Only auto-prompt if they're in dashboard (active user)
      // We'll check the current path
      const isDashboard = window.location.pathname === '/' && document.querySelector('[data-view="dashboard"]')
      if (!isDashboard) return

      // Don't auto-prompt for now — user will see the bell and can enable later
    }

    subscribe()
  }, [user?.id])
}

/**
 * Request push notification permission and subscribe.
 * Call this from a button click handler (user gesture required for permission).
 */
export async function requestPushSubscription(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    await doSubscribe(userId)
    return true
  } catch {
    return false
  }
}

async function doSubscribe(userId: string) {
  try {
    // Get VAPID public key
    const keyRes = await fetch('/api/push/vapid-key')
    if (!keyRes.ok) return
    const { publicKey } = await keyRes.json()
    if (!publicKey) return

    // Register or get service worker
    const registration = await navigator.serviceWorker.ready

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      // Send to server to update
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: existing.toJSON() }),
      }).catch(() => {})
      return
    }

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    }).catch(() => {})
  } catch {
    // Subscription failed — silent
  }
}

// Utility: convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
  const rawData = globalThis.Buffer
    ? Buffer.from(base64, 'base64')
    : atob(base64)
      .split('')
      .map((c) => c.charCodeAt(0))
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData[i]
  }
  return outputArray
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: 'DELETE',
      }).catch(() => {})
    }
  } catch {
    // silent
  }
}
