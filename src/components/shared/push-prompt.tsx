'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

const DISMISSED_KEY = 'push_prompt_dismissed';
const DELAY_MS = 4000; // show after 4s

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushPrompt() {
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const shouldShow = useCallback(() => {
    if (!user || !isPushSupported) return false;
    if (localStorage.getItem(DISMISSED_KEY)) return false;
    if (Notification.permission === 'granted') {
      // Already granted — check if subscribed on server
      return true; // we'll check server-side and hide if already subscribed
    }
    if (Notification.permission === 'denied') return false;
    return true;
  }, [user, isPushSupported]);

  useEffect(() => {
    if (!shouldShow()) return;

    // Check if already subscribed on server
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/push/status');
        const data = await res.json();
        if (data.enabled) {
          // Already subscribed, no need to show prompt
          localStorage.setItem(DISMISSED_KEY, '1');
          return;
        }
        setVisible(true);
      } catch {
        // If check fails, still show the prompt
        setVisible(true);
      }
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [shouldShow]);

  const handleAllow = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error(t('pushPrompt.denied'));
        handleDismiss();
        setLoading(false);
        return;
      }

      const statusRes = await fetch('/api/push/status');
      const statusData = await statusRes.json();
      if (!statusData.vapidKey) {
        toast.error(t('settings.serverError'));
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(statusData.vapidKey),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.toJSON().keys,
        }),
      });

      toast.success(t('pushPrompt.enabled'));
      setVisible(false);
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch (err) {
      console.error('[PushPrompt]', err);
      toast.error(t('settings.serverError'));
    }
    setLoading(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-[9999] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="relative rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-hidden">
            {/* Decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-lime-400 via-emerald-500 to-teal-500" />

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4 text-zinc-400" />
            </button>

            {/* Content */}
            <div className="flex items-start gap-3 mt-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-foreground pr-6">
                  {t('pushPrompt.title')}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t('pushPrompt.desc')}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleAllow}
                    disabled={loading}
                    className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {loading ? (
                      <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Bell className="h-3.5 w-3.5" />
                    )}
                    {t('pushPrompt.allow')}
                  </Button>
                  <button
                    onClick={handleDismiss}
                    className="h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {t('pushPrompt.notNow')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
