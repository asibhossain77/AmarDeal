import { useAppStore } from '@/lib/store'
import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Hook to be mounted at the AdminView root.
 *
 * On mount, it verifies that the current user still has admin access
 * by calling /api/admin/stats. If the server returns 401 or 403,
 * the user is redirected to their normal dashboard view.
 */
export function useAdminGuard() {
  const { user, setView } = useAppStore()

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        if (cancelled) return

        if (res.status === 401) {
          toast.error('সেশন মেয়াদোত্তীর্ণ হয়েছে, আবার লগইন করুন')
          useAppStore.getState().logout()
          return
        }

        if (res.status === 403) {
          toast.error('আপনার অ্যাডমিন অ্যাক্সেস সরানো হয়েছে')
          setView('landing')
          return
        }
      } catch {
        // Network error — ignore, let retry handle it
      }
    }

    check()

    // Re-check every 30 seconds
    const interval = setInterval(check, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user, setView])
}

/**
 * Utility to check if an admin API response indicates lost access.
 *
 * Call this after any admin fetch to immediately redirect on 401/403.
 * Returns true if the response indicates a guard failure (caller should stop).
 *
 * Usage:
 *   const res = await fetch('/api/admin/deals')
 *   if (handleAdminResponse(res)) return
 */
export function handleAdminResponse(res: Response): boolean {
  if (res.status === 401) {
    toast.error('সেশন মেয়াদোত্তীর্ণ হয়েছে, আবার লগইন করুন')
    useAppStore.getState().logout()
    return true
  }

  if (res.status === 403) {
    toast.error('আপনার অ্যাডমিন অ্যাক্সেস সরানো হয়েছে')
    useAppStore.getState().setView('landing')
    return true
  }

  return false
}

/**
 * Wrapper around fetch for admin API calls.
 * Automatically handles 401/403 responses by redirecting the user.
 *
 * Usage:
 *   const data = await adminFetch('/api/admin/stats')
 *   if (data === null) return // redirected
 */
export async function adminFetch<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init)
    if (handleAdminResponse(res)) return null
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}