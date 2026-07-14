'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface NotificationPayload {
  id?: string
  type: string
  title: string
  message: string
  dealId?: string
  createdAt?: string
}

export function useSocket(userId: string | null | undefined) {
  const socketRef = useRef<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [latestNotification, setLatestNotification] = useState<NotificationPayload | null>(null)
  const listenersRef = useRef<Set<(n: NotificationPayload) => void>>(new Set())

  const onNotification = useCallback((callback: (n: NotificationPayload) => void) => {
    listenersRef.current.add(callback)
    return () => { listenersRef.current.delete(callback) }
  }, [])

  useEffect(() => {
    if (!userId) return

    // Dynamic import to avoid SSR issues
    let mounted = true
    const initSocket = async () => {
      try {
        // @ts-expect-error socket.io-client is optional
        const { io } = await import('socket.io-client')
        const socket = io('/?XTransformPort=3004', {
          transports: ['websocket', 'polling'],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
        })

        socketRef.current = socket

        socket.on('connect', () => {
          if (!mounted) return
          setIsConnected(true)
          socket.emit('register', userId)
        })

        socket.on('disconnect', () => {
          if (!mounted) return
          setIsConnected(false)
        })

        socket.on('notification', (data: NotificationPayload) => {
          if (!mounted) return
          setLatestNotification(data)
          listenersRef.current.forEach(cb => cb(data))
        })
      } catch {
        // socket.io not available
      }
    }

    initSocket()

    return () => {
      mounted = false
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setIsConnected(false)
    }
  }, [userId])

  return { isConnected, latestNotification, onNotification, clearLatest: () => setLatestNotification(null) }
}